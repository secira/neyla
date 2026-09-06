import pool from '../db.js';

/**
 * Ensures a user has a personal organization and that all of their legacy
 * workspaces are represented as projects. The operation is safe to call
 * repeatedly after login or from project routes.
 */
export async function ensurePersonalOrganization(userId, userName = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let organizationResult = await client.query(
      'SELECT * FROM organizations WHERE owner_user_id = $1 AND is_personal = TRUE FOR UPDATE',
      [userId],
    );

    if (organizationResult.rows.length === 0) {
      const fallbackName = userName?.trim() || 'Personal';
      const slug = `personal-${String(userId).replace(/-/g, '')}`;

      await client.query(
        `INSERT INTO organizations (name, slug, owner_user_id, is_personal)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT DO NOTHING`,
        [`${fallbackName}'s workspace`, slug, userId],
      );

      organizationResult = await client.query(
        'SELECT * FROM organizations WHERE owner_user_id = $1 AND is_personal = TRUE FOR UPDATE',
        [userId],
      );
    }

    const organization = organizationResult.rows[0];

    if (!organization) {
      throw new Error(`Could not create a personal organization for user ${userId}`);
    }

    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [organization.id, userId],
    );

    await client.query(
      `INSERT INTO projects (organization_id, legacy_workspace_id, title, description, url_id, created_at, updated_at)
       SELECT $1, w.id, COALESCE(w.title, 'Untitled project'), COALESCE(w.description, ''), COALESCE(w.url_id, w.id::text),
              w.created_at, w.updated_at
       FROM workspaces w
       WHERE w.user_id = $2
       ON CONFLICT (legacy_workspace_id) DO NOTHING`,
      [organization.id, userId],
    );

    await client.query('COMMIT');
    return organization;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}