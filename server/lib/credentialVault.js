import crypto from 'node:crypto';
import pool from '../db.js';

const CREDENTIAL_VERSION = 'v1';
const IV_BYTES = 12;

function getEncryptionKey() {
  const configuredSecret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET;

  if (configuredSecret) {
    return crypto.createHash('sha256').update(`neyla:credential-vault:${configuredSecret}`).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Credential encryption is not configured');
  }

  // Development-only fallback. Production requires a Replit-managed secret.
  return crypto.createHash('sha256').update('neyla-development-credential-vault').digest();
}

export function isEncryptedCredential(value) {
  return typeof value === 'string' && value.startsWith(`${CREDENTIAL_VERSION}:`);
}

export function encryptCredential(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    CREDENTIAL_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptCredential(value) {
  if (!value) {
    return null;
  }

  // This compatibility branch is only for legacy rows while the startup
  // migration upgrades them. New writes always use encryptCredential().
  if (!isEncryptedCredential(value)) {
    return value;
  }

  const [, encodedIv, encodedAuthTag, encodedCiphertext] = value.split(':');

  if (!encodedIv || !encodedAuthTag || !encodedCiphertext) {
    throw new Error('Malformed encrypted credential');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));

  return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}

async function migrateProviderCredentials() {
  const result = await pool.query(`
    SELECT id, access_token, refresh_token, access_token_ciphertext, refresh_token_ciphertext
    FROM user_auth_providers
    WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL
  `);

  for (const row of result.rows) {
    const accessTokenCiphertext = row.access_token ? encryptCredential(row.access_token) : row.access_token_ciphertext;
    const refreshTokenCiphertext = row.refresh_token
      ? encryptCredential(row.refresh_token)
      : row.refresh_token_ciphertext;

    await pool.query(
      `UPDATE user_auth_providers
       SET access_token = NULL,
           refresh_token = NULL,
           access_token_ciphertext = $1,
           refresh_token_ciphertext = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [accessTokenCiphertext, refreshTokenCiphertext, row.id],
    );
  }
}

async function migrateDeploymentCredentials() {
  const result = await pool.query(`
    SELECT id, agent_token, agent_token_ciphertext
    FROM deployments
    WHERE agent_token IS NOT NULL
  `);

  for (const row of result.rows) {
    const agentTokenCiphertext = row.agent_token ? encryptCredential(row.agent_token) : row.agent_token_ciphertext;

    await pool.query(
      `UPDATE deployments
       SET agent_token = NULL,
           agent_token_ciphertext = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [agentTokenCiphertext, row.id],
    );
  }
}

export async function migrateStoredCredentials() {
  await migrateProviderCredentials();
  await migrateDeploymentCredentials();
}