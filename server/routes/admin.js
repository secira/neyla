import { Router } from 'express';
import pool from '../db.js';
import { requirePlatformAdmin } from '../middleware/admin.js';
import { encryptManagedSecret, secretMetadata } from '../lib/managedSecrets.js';

const router = Router();
router.use(requirePlatformAdmin);
const safeError = (err) => err?.code || err?.name || 'unknown';

router.get('/overview', async (_req, res) => {
  try {
    const [users, organizations, projects, subscriptions, revenue, secrets] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query('SELECT COUNT(*)::int AS count FROM organizations'),
      pool.query('SELECT COUNT(*)::int AS count FROM projects'),
      pool.query("SELECT COUNT(*)::int AS count FROM organization_billing WHERE status IN ('active','trialing')"),
      pool.query("SELECT COUNT(*)::int AS invoice_count, COALESCE(SUM(amount),0)::int AS revenue FROM invoices WHERE status = 'paid'"),
      pool.query('SELECT id, provider, key_name, hint, enabled, created_at, updated_at FROM global_secrets ORDER BY provider, key_name'),
    ]);
    return res.json({
      counts: {
        users: users.rows[0].count,
        organizations: organizations.rows[0].count,
        projects: projects.rows[0].count,
      },
      billing: {
        activeSubscriptions: subscriptions.rows[0].count,
        paidInvoices: revenue.rows[0].invoice_count,
        revenue: revenue.rows[0].revenue,
        currency: 'USD',
      },
      providerSecrets: secrets.rows.map(secretMetadata),
    });
  } catch (err) {
    console.error('Admin overview error:', safeError(err));
    return res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const search = `%${String(req.query.search || '').slice(0, 100)}%`;
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.global_role, u.created_at,
        (SELECT COUNT(*)::int FROM organization_members om WHERE om.user_id = u.id) AS organization_count,
        (SELECT COUNT(*)::int FROM projects p JOIN organization_members om ON om.organization_id = p.organization_id WHERE om.user_id = u.id) AS project_count
       FROM users u WHERE ($1 = '%%' OR u.email ILIKE $1 OR u.name ILIKE $1) ORDER BY u.created_at DESC LIMIT 500`,
      [search],
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin users error:', safeError(err));
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  const role = req.body?.role;
  if (!['user', 'platform_admin', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const result = await pool.query('UPDATE users SET global_role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, global_role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Admin role error:', safeError(err));
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

router.get('/organizations', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, o.is_personal, o.created_at,
        COUNT(DISTINCT om.user_id)::int AS member_count,
        COUNT(DISTINCT p.id)::int AS project_count,
         ob.plan AS subscription_plan, ob.status AS subscription_status, ob.current_period_end
       FROM organizations o
       LEFT JOIN organization_members om ON om.organization_id = o.id
       LEFT JOIN projects p ON p.organization_id = o.id
       LEFT JOIN organization_billing ob ON ob.organization_id = o.id
       GROUP BY o.id, ob.plan, ob.status, ob.current_period_end ORDER BY o.created_at DESC`,
    );
    return res.json({ organizations: result.rows });
  } catch (err) {
    console.error('Admin organizations error:', safeError(err));
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/billing', async (_req, res) => {
  try {
    const [organizations, users, invoices] = await Promise.all([
      pool.query('SELECT ob.*, o.name AS organization_name FROM organization_billing ob JOIN organizations o ON o.id = ob.organization_id ORDER BY ob.updated_at DESC'),
      pool.query('SELECT s.*, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id ORDER BY s.updated_at DESC'),
      pool.query('SELECT i.*, u.email FROM invoices i JOIN users u ON u.id = i.user_id ORDER BY i.issued_at DESC LIMIT 1000'),
    ]);
    return res.json({
      billing: [
        ...organizations.rows.map((item) => ({
          id: item.id,
          owner_email: item.organization_name,
          organization_name: item.organization_name,
          plan: item.plan,
          status: item.status,
          amount: 0,
          currency: 'USD',
          current_period_end: item.current_period_end,
          source: 'organization',
        })),
        ...users.rows.map((item) => ({
          id: item.id,
          owner_email: item.email,
          organization_name: null,
          plan: item.plan,
          status: item.status,
          amount: 0,
          currency: 'USD',
          current_period_end: item.current_period_end,
          source: 'user',
        })),
        ...invoices.rows.map((item) => ({
          id: item.id,
          owner_email: item.email,
          organization_name: null,
          plan: item.plan,
          status: item.status,
          amount: item.amount,
          currency: item.currency,
          current_period_end: item.paid_at,
          source: 'invoice',
        })),
      ],
    });
  } catch (err) {
    console.error('Admin billing error:', safeError(err));
    return res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

router.get('/secrets', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, provider, key_name, hint, enabled, created_at, updated_at FROM global_secrets ORDER BY provider, key_name');
    return res.json({ secrets: result.rows.map(secretMetadata) });
  } catch (err) {
    console.error('Admin secrets error:', safeError(err));
    return res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

router.post('/secrets', async (req, res) => {
  const { provider, key_name: keyName, value } = req.body || {};
  if (!provider || !keyName || !value) return res.status(400).json({ error: 'Provider, key name, and value are required' });
  try {
    const encrypted = encryptManagedSecret(value);
    const result = await pool.query(
      `INSERT INTO global_secrets (provider, key_name, ciphertext, hint, updated_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (provider,key_name) DO UPDATE SET ciphertext=EXCLUDED.ciphertext, hint=EXCLUDED.hint, enabled=TRUE, updated_by=EXCLUDED.updated_by, updated_at=NOW()
       RETURNING id, provider, key_name, hint, enabled, created_at, updated_at`,
      [provider, keyName, encrypted.ciphertext, encrypted.hint, req.user.id],
    );
    return res.status(201).json({ secret: secretMetadata(result.rows[0]) });
  } catch (err) {
    console.error('Admin save secret error:', safeError(err));
    return res.status(500).json({ error: 'Failed to save secret' });
  }
});

router.put('/secrets/:id', async (req, res) => {
  const { value, enabled, provider, key_name: keyName } = req.body || {};
  try {
    const fields = [], params = [];
    if (value) { const encrypted = encryptManagedSecret(value); fields.push(`ciphertext=$${params.push(encrypted.ciphertext)}`, `hint=$${params.push(encrypted.hint)}`); }
    if (typeof enabled === 'boolean') fields.push(`enabled=$${params.push(enabled)}`);
    if (provider) fields.push(`provider=$${params.push(provider)}`);
    if (keyName) fields.push(`key_name=$${params.push(keyName)}`);
    if (!fields.length) return res.status(400).json({ error: 'No changes supplied' });
    fields.push(`updated_by=$${params.push(req.user.id)}`, 'updated_at=NOW()');
    params.push(req.params.id);
    const result = await pool.query(`UPDATE global_secrets SET ${fields.join(',')} WHERE id=$${params.length} RETURNING id, provider, key_name, hint, enabled, created_at, updated_at`, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Secret not found' });
    return res.json({ secret: secretMetadata(result.rows[0]) });
  } catch (err) {
    console.error('Admin update secret error:', safeError(err));
    return res.status(500).json({ error: 'Failed to update secret' });
  }
});

router.delete('/secrets/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM global_secrets WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Secret not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Admin delete secret error:', safeError(err));
    return res.status(500).json({ error: 'Failed to delete secret' });
  }
});

export default router;