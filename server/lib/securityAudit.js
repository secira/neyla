import pool from '../db.js';

export async function recordSecurityEvent({
  userId,
  action,
  provider = null,
  deploymentId = null,
  metadata = {},
}) {
  try {
    await pool.query(
      `INSERT INTO security_audit_events (user_id, action, provider, deployment_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, provider, deploymentId, JSON.stringify(metadata)],
    );
  } catch (error) {
    // Auditing must never log or expose credential values, and a logging
    // failure must not undo a completed revocation.
    console.error('Security audit write failed:', error?.code || error?.name || 'unknown');
  }
}