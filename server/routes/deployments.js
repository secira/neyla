import { Router } from 'express';
import crypto from 'node:crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isAwsConfigured, launchInstance, getInstanceState } from '../lib/aws.js';
import { buildUserData } from '../lib/deployAgent.js';
import { decryptCredential, encryptCredential } from '../lib/credentialVault.js';

const router = Router();

const MAX_FILES = 500;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10 MB
const AGENT_STALE_MS = 60 * 1000;

function getServerBase() {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  return 'http://localhost:5000';
}

function publicView(row) {
  return {
    id: row.id,
    status: row.status,
    statusDetail: row.status_detail,
    error: row.error,
    url: row.url,
    publicIp: row.public_ip,
    bundleVersion: row.bundle_version,
    deployedVersion: row.deployed_version,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function setStatus(deploymentId, status, { detail = null, error = null, extraSql = '', extraParams = [] } = {}) {
  await pool.query(
    `UPDATE deployments SET status = $1, status_detail = $2, error = $3, updated_at = NOW() ${extraSql} WHERE id = $4`,
    [status, detail, error, deploymentId, ...extraParams],
  );
}

async function provisionInFlight(deployment) {
  try {
    const instanceId = await launchInstance({
      name: `neyla-${deployment.id.slice(0, 8)}`,
      userData: buildUserData({
        serverBase: getServerBase(),
        deploymentId: deployment.id,
        agentToken: decryptCredential(deployment.agent_token_ciphertext),
      }),
    });

    await pool.query(
      "UPDATE deployments SET instance_id = $1, status = 'booting', status_detail = 'Waiting for the server to start', updated_at = NOW() WHERE id = $2",
      [instanceId, deployment.id],
    );

    // Poll for the public IP (up to ~3 minutes)
    for (let attempt = 0; attempt < 36; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));

      const state = await getInstanceState(instanceId);

      if (state?.publicIp) {
        await pool.query(
          "UPDATE deployments SET public_ip = $1, url = $2, status = 'deploying', status_detail = 'Server is up — installing your app', updated_at = NOW() WHERE id = $3",
          [state.publicIp, `http://${state.publicIp}`, deployment.id],
        );
        return;
      }

      if (state?.state === 'terminated' || state?.state === 'shutting-down') {
        throw new Error('The server was terminated unexpectedly');
      }
    }

    throw new Error('Timed out waiting for the server to get a public address');
  } catch (err) {
    console.error('Provisioning error:', err?.code || err?.name || 'unknown');
    await setStatus(deployment.id, 'error', {
      error: 'Failed to set up the server',
    });
  }
}

// ---------- Agent endpoints (token auth, called by the EC2 instance) ----------

async function agentAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, user_id, bundle_version, agent_token_ciphertext
     FROM deployments WHERE id = $1`,
    [req.params.id],
  );
  const deployment = result.rows[0];

  const tokensMatch =
    deployment &&
    crypto.timingSafeEqual(
      crypto.createHash('sha256').update(String(decryptCredential(deployment.agent_token_ciphertext))).digest(),
      crypto.createHash('sha256').update(token).digest(),
    );

  if (!tokensMatch) {
    res.status(403).json({ error: 'Invalid token' });
    return null;
  }

  return deployment;
}

router.get('/agent/:id/poll', async (req, res) => {
  try {
    const deployment = await agentAuth(req, res);

    if (!deployment) {
      return undefined;
    }

    await pool.query('UPDATE deployments SET last_agent_poll = NOW() WHERE id = $1', [deployment.id]);

    return res.json({ version: deployment.bundle_version });
  } catch (err) {
    console.error('Agent poll error:', err);
    return res.status(500).json({ error: 'Poll failed' });
  }
});

router.get('/agent/:id/bundle', async (req, res) => {
  try {
    const deployment = await agentAuth(req, res);

    if (!deployment) {
      return undefined;
    }

    const bundle = await pool.query('SELECT version, files FROM deployment_bundles WHERE deployment_id = $1', [
      deployment.id,
    ]);

    if (bundle.rows.length === 0) {
      return res.status(404).json({ error: 'No bundle' });
    }

    return res.json({ version: bundle.rows[0].version, files: bundle.rows[0].files });
  } catch (err) {
    console.error('Agent bundle error:', err);
    return res.status(500).json({ error: 'Bundle fetch failed' });
  }
});

router.post('/agent/:id/status', async (req, res) => {
  try {
    const deployment = await agentAuth(req, res);

    if (!deployment) {
      return undefined;
    }

    const { status, detail, error, version } = req.body || {};

    if (!['deploying', 'live', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (status === 'live') {
      await pool.query(
        "UPDATE deployments SET status = 'live', status_detail = NULL, error = NULL, deployed_version = $1, last_agent_poll = NOW(), updated_at = NOW() WHERE id = $2",
        [Number(version) || deployment.bundle_version, deployment.id],
      );
    } else {
      await setStatus(deployment.id, status, {
        detail: typeof detail === 'string' ? detail.slice(0, 300) : null,
        error: typeof error === 'string' ? error.slice(0, 1000) : null,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Agent status error:', err);
    return res.status(500).json({ error: 'Status update failed' });
  }
});

// ---------- User endpoints (cookie auth) ----------

router.use(requireAuth);

async function getOwnedWorkspace(req, res) {
  const result = await pool.query('SELECT * FROM workspaces WHERE id = $1 AND user_id = $2', [
    req.params.workspaceId,
    req.user.id,
  ]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Workspace not found' });
    return null;
  }

  return result.rows[0];
}

router.get('/workspace/:workspaceId', async (req, res) => {
  try {
    const workspace = await getOwnedWorkspace(req, res);

    if (!workspace) {
      return undefined;
    }

    const result = await pool.query(
      `SELECT id, status, status_detail, error, url, public_ip,
              bundle_version, deployed_version, updated_at, created_at
       FROM deployments WHERE workspace_id = $1`,
      [workspace.id],
    );

    if (result.rows.length === 0) {
      return res.json({ deployment: null, awsConfigured: isAwsConfigured() });
    }

    return res.json({ deployment: publicView(result.rows[0]), awsConfigured: isAwsConfigured() });
  } catch (err) {
    console.error('Get deployment error:', err);
    return res.status(500).json({ error: 'Failed to fetch deployment' });
  }
});

router.post('/workspace/:workspaceId/publish', async (req, res) => {
  try {
    const workspace = await getOwnedWorkspace(req, res);

    if (!workspace) {
      return undefined;
    }

    if (!isAwsConfigured()) {
      return res.status(503).json({
        error: 'Publishing is not set up yet — AWS credentials have not been configured.',
        code: 'aws_not_configured',
      });
    }

    const { files } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files to publish' });
    }

    if (files.length > MAX_FILES) {
      return res.status(400).json({ error: `Too many files (max ${MAX_FILES})` });
    }

    let totalSize = 0;

    for (const f of files) {
      if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') {
        return res.status(400).json({ error: 'Invalid file entry' });
      }

      if (f.path.startsWith('/') || f.path.split('/').includes('..')) {
        return res.status(400).json({ error: `Invalid file path: ${f.path}` });
      }

      totalSize += f.content.length;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({ error: 'Project is too large to publish (max 10 MB)' });
    }

    // Atomically get-or-create the deployment row and bump the bundle version
    const client = await pool.connect();
    let deployment;
    let needsProvisioning = false;

    try {
      await client.query('BEGIN');

      const result = await client.query('SELECT * FROM deployments WHERE workspace_id = $1 FOR UPDATE', [
        workspace.id,
      ]);
      deployment = result.rows[0];

      if (!deployment) {
        const agentToken = crypto.randomBytes(32).toString('hex');
        const inserted = await client.query(
          `INSERT INTO deployments (workspace_id, user_id, status, status_detail, agent_token_ciphertext)
           VALUES ($1, $2, 'provisioning', 'Setting up your server on AWS', $3)
           ON CONFLICT (workspace_id) DO NOTHING RETURNING *`,
          [workspace.id, req.user.id, encryptCredential(agentToken)],
        );

        if (inserted.rows.length === 0) {
          // Lost a concurrent-insert race; the other request is handling provisioning
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'A publish is already in progress. Please wait for it to finish.' });
        }

        deployment = inserted.rows[0];
      } else if (['provisioning', 'booting'].includes(deployment.status)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A publish is already in progress. Please wait for it to finish.' });
      }

      const newVersion = deployment.bundle_version + 1;

      await client.query(
        `INSERT INTO deployment_bundles (deployment_id, version, files) VALUES ($1, $2, $3)
         ON CONFLICT (deployment_id) DO UPDATE SET version = $2, files = $3, created_at = NOW()`,
        [deployment.id, newVersion, JSON.stringify(files)],
      );

      if (!deployment.instance_id) {
        needsProvisioning = true;
        await client.query(
          `UPDATE deployments SET bundle_version = $1, status = 'provisioning', status_detail = 'Setting up your server on AWS', error = NULL, updated_at = NOW() WHERE id = $2`,
          [newVersion, deployment.id],
        );
      } else {
        const stale =
          !deployment.last_agent_poll ||
          Date.now() - new Date(deployment.last_agent_poll).getTime() > AGENT_STALE_MS * 5;

        await client.query(
          `UPDATE deployments SET bundle_version = $1, status = 'deploying', status_detail = $2, error = NULL, updated_at = NOW() WHERE id = $3`,
          [
            newVersion,
            stale ? 'Waiting for the server to pick up the update' : 'Updating your app on the server',
            deployment.id,
          ],
        );
      }

      await client.query('COMMIT');
      deployment = { ...deployment, bundle_version: newVersion };
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    if (needsProvisioning) {
      // Fire-and-forget: provisioning takes minutes; the UI polls for status.
      provisionInFlight(deployment);
    }

    const fresh = await pool.query(
      `SELECT id, status, status_detail, error, url, public_ip,
              bundle_version, deployed_version, updated_at, created_at
       FROM deployments WHERE id = $1`,
      [deployment.id],
    );

    return res.status(202).json({ deployment: publicView(fresh.rows[0]) });
  } catch (err) {
    console.error('Publish error:', err);
    return res.status(500).json({ error: 'Failed to publish' });
  }
});

export default router;
