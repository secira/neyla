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

function contextView(row) {
  return {
    project_id: row.project_id,
    application_spec: row.application_spec || {},
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    updated_at: row.updated_at,
  };
}

function planView(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    version: row.version,
    request: row.request,
    title: row.title,
    summary: row.summary,
    specification: row.specification || {},
    steps: Array.isArray(row.steps) ? row.steps : [],
    assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    approved_at: row.approved_at,
  };
}

async function ensureProjectContext(projectId) {
  await pool.query(
    `INSERT INTO project_context (project_id)
     VALUES ($1)
     ON CONFLICT (project_id) DO NOTHING`,
    [projectId],
  );
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

router.get('/:id/context', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await ensureProjectContext(project.id);
    const [context, plans] = await Promise.all([
      pool.query('SELECT * FROM project_context WHERE project_id = $1', [project.id]),
      pool.query(
        'SELECT * FROM project_build_plans WHERE project_id = $1 ORDER BY version DESC',
        [project.id],
      ),
    ]);

    return res.json({
      context: contextView(context.rows[0]),
      plans: plans.rows.map(planView),
    });
  } catch (err) {
    console.error('Get project context error:', err);
    return res.status(500).json({ error: 'Failed to fetch project context' });
  }
});

router.put('/:id/context', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { applicationSpec, decisions } = req.body || {};
    await pool.query(
      `INSERT INTO project_context (project_id, application_spec, decisions, updated_at)
       VALUES ($1, COALESCE($2, '{}'::jsonb), COALESCE($3, '[]'::jsonb), NOW())
       ON CONFLICT (project_id) DO UPDATE SET
         application_spec = COALESCE($2, project_context.application_spec),
         decisions = COALESCE($3, project_context.decisions),
         updated_at = NOW()`,
      [project.id, applicationSpec ? JSON.stringify(applicationSpec) : null, decisions ? JSON.stringify(decisions) : null],
    );

    const context = await pool.query('SELECT * FROM project_context WHERE project_id = $1', [project.id]);
    return res.json({ context: contextView(context.rows[0]) });
  } catch (err) {
    console.error('Update project context error:', err);
    return res.status(500).json({ error: 'Failed to update project context' });
  }
});

router.post('/:id/plans', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { request = '', title, summary = '', specification = {}, steps = [], assumptions = [], decisions = [], status = 'draft' } =
      req.body || {};

    if (!title || !['draft', 'approved', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'A plan title and valid status are required' });
    }

    const result = await pool.query(
      `INSERT INTO project_build_plans
        (project_id, version, request, title, summary, specification, steps, assumptions, decisions, status, approved_at)
       VALUES (
         $1,
         COALESCE((SELECT MAX(version) + 1 FROM project_build_plans WHERE project_id = $1), 1),
         $2, $3, $4, $5, $6, $7, $8, $9,
         CASE WHEN $9 = 'approved' THEN NOW() ELSE NULL END
       )
       RETURNING *`,
      [
        project.id,
        request,
        title,
        summary,
        JSON.stringify(specification),
        JSON.stringify(Array.isArray(steps) ? steps : []),
        JSON.stringify(Array.isArray(assumptions) ? assumptions : []),
        JSON.stringify(Array.isArray(decisions) ? decisions : []),
        status,
      ],
    );

    if (status === 'approved') {
      await pool.query(
        `INSERT INTO project_context (project_id, application_spec, decisions, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (project_id) DO UPDATE SET
           application_spec = $2,
           decisions = $3,
           updated_at = NOW()`,
        [project.id, JSON.stringify(specification), JSON.stringify(Array.isArray(decisions) ? decisions : [])],
      );
    }

    return res.status(201).json({ plan: planView(result.rows[0]) });
  } catch (err) {
    console.error('Create project plan error:', err);
    return res.status(500).json({ error: 'Failed to create project plan' });
  }
});

router.patch('/:id/plans/:planId', async (req, res) => {
  try {
    await ensurePersonalOrganization(req.user.id, req.user.name);
    const project = await getAuthorizedProject(req.user.id, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existing = await pool.query(
      'SELECT * FROM project_build_plans WHERE id = $1 AND project_id = $2',
      [req.params.planId, project.id],
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Build plan not found' });
    }

    const body = req.body || {};
    const status = body.status || existing.rows[0].status;

    if (!['draft', 'approved', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid build plan status' });
    }

    const result = await pool.query(
      `UPDATE project_build_plans
       SET title = COALESCE($1, title),
           summary = COALESCE($2, summary),
           specification = COALESCE($3, specification),
           steps = COALESCE($4, steps),
           assumptions = COALESCE($5, assumptions),
           decisions = COALESCE($6, decisions),
           status = $7,
           updated_at = NOW(),
           approved_at = CASE WHEN $7 = 'approved' THEN COALESCE(approved_at, NOW()) ELSE approved_at END
       WHERE id = $8 AND project_id = $9
       RETURNING *`,
      [
        body.title,
        body.summary,
        body.specification ? JSON.stringify(body.specification) : null,
        Array.isArray(body.steps) ? JSON.stringify(body.steps) : null,
        Array.isArray(body.assumptions) ? JSON.stringify(body.assumptions) : null,
        Array.isArray(body.decisions) ? JSON.stringify(body.decisions) : null,
        status,
        req.params.planId,
        project.id,
      ],
    );

    const plan = result.rows[0];
    if (status === 'approved') {
      await pool.query(
        `INSERT INTO project_context (project_id, application_spec, decisions, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (project_id) DO UPDATE SET
           application_spec = $2,
           decisions = $3,
           updated_at = NOW()`,
        [project.id, JSON.stringify(plan.specification || {}), JSON.stringify(plan.decisions || [])],
      );
    }

    return res.json({ plan: planView(plan) });
  } catch (err) {
    console.error('Update project plan error:', err);
    return res.status(500).json({ error: 'Failed to update project plan' });
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