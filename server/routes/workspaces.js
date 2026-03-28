import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

    return res.json({ success: true });
  } catch (err) {
    console.error('Update workspace error:', err);
    return res.status(500).json({ error: 'Failed to update workspace' });
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
