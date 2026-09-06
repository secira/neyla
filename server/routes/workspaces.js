import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { decryptCredential } from '../lib/credentialVault.js';
import { ensurePersonalOrganization } from '../lib/projectFoundation.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, url_id, git_url, git_branch, netlify_site_id, created_at, updated_at FROM workspaces WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.id],
    );
    return res.json({ workspaces: result.rows });
  } catch (err) {
    console.error('Get workspaces error:', err);
    return res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const wsResult = await pool.query(
      'SELECT * FROM workspaces WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );

    if (wsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const ws = wsResult.rows[0];

    const msgResult = await pool.query(
      'SELECT id, role, content, annotations, created_at FROM workspace_messages WHERE workspace_id = $1 ORDER BY created_at ASC',
      [ws.id],
    );

    const snapResult = await pool.query(
      'SELECT snapshot_data FROM workspace_snapshots WHERE workspace_id = $1',
      [ws.id],
    );

    return res.json({
      workspace: ws,
      messages: msgResult.rows,
      snapshot: snapResult.rows[0]?.snapshot_data || null,
    });
  } catch (err) {
    console.error('Get workspace error:', err);
    return res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, urlId, messages, snapshot, gitUrl, gitBranch, netlifySiteId } =
      req.body;

    const finalUrlId = urlId || uuidv4();

    const existingUrl = await pool.query(
      'SELECT id FROM workspaces WHERE url_id = $1 AND user_id != $2',
      [finalUrlId, req.user.id],
    );

    if (existingUrl.rows.length > 0) {
      return res.status(409).json({ error: 'URL ID already taken' });
    }

    const wsResult = await pool.query(
      `INSERT INTO workspaces (user_id, title, description, url_id, git_url, git_branch, netlify_site_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, title || 'Untitled', description || '', finalUrlId, gitUrl, gitBranch, netlifySiteId],
    );

    const ws = wsResult.rows[0];

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        await pool.query(
          'INSERT INTO workspace_messages (workspace_id, role, content, annotations) VALUES ($1, $2, $3, $4)',
          [ws.id, msg.role, msg.content, msg.annotations ? JSON.stringify(msg.annotations) : null],
        );
      }
    }

    if (snapshot) {
      await pool.query(
        'INSERT INTO workspace_snapshots (workspace_id, snapshot_data) VALUES ($1, $2)',
        [ws.id, JSON.stringify(snapshot)],
      );
    }

    const organization = await ensurePersonalOrganization(req.user.id, req.user.name);
    await pool.query(
      `INSERT INTO projects (organization_id, legacy_workspace_id, title, description, url_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (legacy_workspace_id) DO UPDATE
       SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = NOW()`,
      [organization.id, ws.id, ws.title, ws.description, ws.url_id, ws.created_at, ws.updated_at],
    );

    return res.status(201).json({ workspace: ws });
  } catch (err) {
    console.error('Create workspace error:', err);
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { title, description, messages, snapshot, gitUrl, gitBranch, netlifySiteId } = req.body;

    await pool.query(
      `UPDATE workspaces SET title = COALESCE($1, title), description = COALESCE($2, description),
       git_url = COALESCE($3, git_url), git_branch = COALESCE($4, git_branch),
       netlify_site_id = COALESCE($5, netlify_site_id), updated_at = NOW()
       WHERE id = $6`,
      [title, description, gitUrl, gitBranch, netlifySiteId, req.params.id],
    );

    if (messages !== undefined) {
      await pool.query('DELETE FROM workspace_messages WHERE workspace_id = $1', [req.params.id]);

      for (const msg of messages) {
        await pool.query(
          'INSERT INTO workspace_messages (workspace_id, role, content, annotations) VALUES ($1, $2, $3, $4)',
          [req.params.id, msg.role, msg.content, msg.annotations ? JSON.stringify(msg.annotations) : null],
        );
      }
    }

    if (snapshot !== undefined) {
      await pool.query(
        `INSERT INTO workspace_snapshots (workspace_id, snapshot_data) VALUES ($1, $2)
         ON CONFLICT (workspace_id) DO UPDATE SET snapshot_data = $2`,
        [req.params.id, JSON.stringify(snapshot)],
      );
    }

    await pool.query(
      `UPDATE projects
       SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW()
       WHERE legacy_workspace_id = $3`,
      [title, description, req.params.id],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Update workspace error:', err);
    return res.status(500).json({ error: 'Failed to update workspace' });
  }
});

const MAX_SYNC_FILES = 500;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10 MB
const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

async function ghFetch(token, path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
}

router.post('/:id/github-sync', async (req, res) => {
  try {
    const wsResult = await pool.query('SELECT * FROM workspaces WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);

    if (wsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspace = wsResult.rows[0];

    const { repoName, files, commitMessage } = req.body || {};

    if (!repoName || !REPO_NAME_RE.test(repoName)) {
      return res.status(400).json({
        error: 'Repository name can only contain letters, numbers, dashes, dots and underscores',
      });
    }

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files to sync' });
    }

    if (files.length > MAX_SYNC_FILES) {
      return res.status(400).json({ error: `Too many files (max ${MAX_SYNC_FILES})` });
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
      return res.status(400).json({ error: 'Project is too large to sync (max 10 MB)' });
    }

    const tokenResult = await pool.query(
      "SELECT access_token_ciphertext FROM user_auth_providers WHERE user_id = $1 AND provider = 'github'",
      [req.user.id],
    );

    const token = decryptCredential(tokenResult.rows[0]?.access_token_ciphertext);

    if (!token) {
      return res.status(403).json({ error: 'GitHub is not connected', code: 'github_not_connected' });
    }

    const userRes = await ghFetch(token, '/user');

    if (!userRes.ok) {
      return res
        .status(403)
        .json({ error: 'GitHub connection is no longer valid. Please reconnect.', code: 'github_reauth' });
    }

    const owner = userRes.data.login;

    // Get or create the repository
    let repoRes = await ghFetch(token, `/repos/${owner}/${repoName}`);
    let repo = repoRes.ok ? repoRes.data : null;
    let created = false;

    if (!repo) {
      const createRes = await ghFetch(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: repoName,
          private: true,
          auto_init: true,
          description: workspace.description || 'Created with Neyla',
        }),
      });

      if (!createRes.ok) {
        const msg = createRes.data?.errors?.[0]?.message || createRes.data?.message || 'Failed to create repository';
        return res.status(502).json({ error: `GitHub: ${msg}` });
      }

      repo = createRes.data;
      created = true;
    }

    const branch = repo.default_branch || 'main';

    // Fetch the current head of the default branch (retry briefly for a
    // freshly auto-initialized repo)
    let headSha = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const refRes = await ghFetch(token, `/repos/${owner}/${repoName}/git/ref/${encodeURIComponent(`heads/${branch}`)}`);

      if (refRes.ok) {
        headSha = refRes.data.object.sha;
        break;
      }

      if (!created) {
        break;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    // Existing repo with no commits yet (empty repo): bootstrap it with an
    // initial commit via the Contents API so the Git Data flow below works.
    if (!headSha) {
      const bootstrapRes = await ghFetch(token, `/repos/${owner}/${repoName}/contents/.neyla`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Initialize repository (Neyla)',
          content: Buffer.from('Created with Neyla\n', 'utf8').toString('base64'),
          branch,
        }),
      });

      if (bootstrapRes.ok) {
        const refRes = await ghFetch(
          token,
          `/repos/${owner}/${repoName}/git/ref/${encodeURIComponent(`heads/${branch}`)}`,
        );

        if (refRes.ok) {
          headSha = refRes.data.object.sha;
        }
      }
    }

    if (!headSha) {
      return res.status(502).json({ error: 'Could not read the repository branch. Please try again.' });
    }

    // Create blobs for each file
    const treeEntries = [];

    for (const f of files) {
      const blobRes = await ghFetch(token, `/repos/${owner}/${repoName}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: Buffer.from(f.content, 'utf8').toString('base64'),
          encoding: 'base64',
        }),
      });

      if (!blobRes.ok) {
        return res.status(502).json({ error: `GitHub: failed to upload ${f.path}` });
      }

      treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: blobRes.data.sha });
    }

    // Full-snapshot tree (no base_tree) so removed files disappear from the repo
    const treeRes = await ghFetch(token, `/repos/${owner}/${repoName}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ tree: treeEntries }),
    });

    if (!treeRes.ok) {
      return res.status(502).json({ error: 'GitHub: failed to build the file tree' });
    }

    const commitRes = await ghFetch(token, `/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage || `Sync from Neyla — ${new Date().toISOString()}`,
        tree: treeRes.data.sha,
        parents: [headSha],
      }),
    });

    if (!commitRes.ok) {
      return res.status(502).json({ error: 'GitHub: failed to create the commit' });
    }

    const updateRefRes = await ghFetch(
      token,
      `/repos/${owner}/${repoName}/git/refs/${encodeURIComponent(`heads/${branch}`)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitRes.data.sha, force: false }),
      },
    );

    if (!updateRefRes.ok) {
      return res.status(502).json({ error: 'GitHub: failed to update the branch' });
    }

    const repoUrl = repo.html_url;

    await pool.query('UPDATE workspaces SET git_url = $1, git_branch = $2, updated_at = NOW() WHERE id = $3', [
      repoUrl,
      branch,
      req.params.id,
    ]);
    await pool.query('UPDATE projects SET updated_at = NOW() WHERE legacy_workspace_id = $1', [req.params.id]);

    return res.json({
      success: true,
      repoUrl,
      branch,
      created,
      commitSha: commitRes.data.sha,
    });
  } catch (err) {
    console.error('GitHub sync error:', err);
    return res.status(500).json({ error: 'Failed to sync to GitHub' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM workspaces WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete workspace error:', err);
    return res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

export default router;
