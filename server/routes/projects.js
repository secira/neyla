import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ensurePersonalOrganization } from '../lib/projectFoundation.js';

const router = Router();

router.use(requireAuth);

async function getAuthorizedProject(userId, projectId) {
  const result = await pool.query(
    `SELECT
       p.*,
       w.id AS workspace_id,
       w.git_url,
       w.git_branch,
       w.netlify_site_id
     FROM projects p
     JOIN organization_members om ON om.organization_id = p.organization_id
     JOIN workspaces w ON w.id = p.legacy_workspace_id
     WHERE p.id = $1 AND om.user_id = $2`,
    [projectId, userId],
  );

  return result.rows[0] || null;
}

function projectView(row) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    legacy_workspace_id: row.legacy_workspace_id,
    workspace_id: row.workspace_id,
    title: row.title,
    description: row.description,
    url_id: row.url_id,
    status: row.status,
    git_url: row.git_url,
    git_branch: row.git_branch,
    netlify_site_id: row.netlify_site_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);

    const result = await pool.query(
      `SELECT
         p.*,
         w.id AS workspace_id,
         w.git_url,
         w.git_branch,
         w.netlify_site_id
       FROM projects p
       JOIN organization_members om ON om.organization_id = p.organization_id
       JOIN workspaces w ON w.id = p.legacy_workspace_id
       WHERE om.user_id = $1
       ORDER BY p.updated_at DESC`,
      [req.user.id],
    );

    return res.json({ projects: result.rows.map(projectView) });
  } catch (err) {
    console.error('Get projects error:', err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [messages, snapshot] = await Promise.all([
      pool.query(
        'SELECT id, role, content, annotations, created_at FROM workspace_messages WHERE workspace_id = $1 ORDER BY created_at ASC',
        [project.workspace_id],
      ),
      pool.query('SELECT snapshot_data FROM workspace_snapshots WHERE workspace_id = $1', [project.workspace_id]),
    ]);

    return res.json({
      project: projectView(project),
      messages: messages.rows,
      snapshot: snapshot.rows[0]?.snapshot_data || null,
    });
  } catch (err) {
    console.error('Get project error:', err);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const organization = await ensurePersonalOrganization(req.user.id, req.user.name);
    const { title, description, urlId, messages, snapshot } = req.body || {};
    const finalUrlId = urlId || uuidv4();

    await client.query('BEGIN');

    const workspaceResult = await client.query(
      `INSERT INTO workspaces (user_id, title, description, url_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, title || 'Untitled project', description || '', finalUrlId],
    );
    const workspace = workspaceResult.rows[0];

    const projectResult = await client.query(
      `INSERT INTO projects (organization_id, legacy_workspace_id, title, description, url_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [organization.id, workspace.id, title || 'Untitled project', description || '', finalUrlId],
    );

    if (Array.isArray(messages)) {
      for (const message of messages) {
        await client.query(
          'INSERT INTO workspace_messages (workspace_id, role, content, annotations) VALUES ($1, $2, $3, $4)',
          [workspace.id, message.role, message.content, message.annotations ? JSON.stringify(message.annotations) : null],
        );
      }
    }

    if (snapshot !== undefined && snapshot !== null) {
      await client.query(
        'INSERT INTO workspace_snapshots (workspace_id, snapshot_data) VALUES ($1, $2)',
        [workspace.id, JSON.stringify(snapshot)],
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ project: projectResult.rows[0], workspace });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Project URL is already in use' });
    }

    console.error('Create project error:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { title, description } = req.body || {};
    await pool.query(
      `UPDATE projects
       SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW()
       WHERE id = $3`,
      [title, description, project.id],
    );
    await pool.query(
      `UPDATE workspaces
       SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW()
       WHERE id = $3`,
      [title, description, project.workspace_id],
    );

    const updated = await getAuthorizedProject(req.user.id, req.params.id);
    return res.json({ project: projectView(updated) });
  } catch (err) {
    console.error('Update project error:', err);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query('DELETE FROM workspaces WHERE id = $1', [project.workspace_id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete project error:', err);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;