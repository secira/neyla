import pool from '../db.js';
import { requireAuth } from './auth.js';

export function requirePlatformAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const result = await pool.query('SELECT global_role, email FROM users WHERE id = $1', [req.user.id]);
      const user = result.rows[0];
      const bootstrap = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (!user || (user.global_role !== 'platform_admin' && user.global_role !== 'admin' && !bootstrap.includes(String(user.email || '').toLowerCase()))) {
        return res.status(403).json({ error: 'Platform admin access required' });
      }
      req.user.global_role = user.global_role;
      next();
    } catch {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
  });
}