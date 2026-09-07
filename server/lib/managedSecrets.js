import { decryptCredential, encryptCredential } from './credentialVault.js';

export function safeSecretHint(value) {
  if (!value) return null;
  const text = String(value);
  if (text.length <= 4) return '••••';
  return `${text.slice(0, 2)}••••${text.slice(-2)}`;
}

export const getSecretHint = safeSecretHint;

export function secretMetadata(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    key_name: row.key_name,
    hint: row.hint || null,
    secret_hint: row.hint || null,
    enabled: row.enabled !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function encryptManagedSecret(value) {
  return { ciphertext: encryptCredential(value), hint: safeSecretHint(value) };
}

export function decryptManagedSecret(row) {
  return row?.ciphertext ? decryptCredential(row.ciphertext) : null;
}

export async function getGlobalSecret(pool, provider, keyName, envName = keyName) {
  const result = await pool.query(
    'SELECT ciphertext, enabled FROM global_secrets WHERE provider = $1 AND key_name = $2',
    [provider, keyName],
  );
  if (result.rows[0]?.enabled && result.rows[0].ciphertext) return decryptCredential(result.rows[0].ciphertext);
  const normalized = `${provider}_${keyName}`.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  return process.env[envName] || process.env[keyName] || process.env[normalized] || null;
}

export async function getUserSecret(pool, userId, provider, keyName) {
  const result = await pool.query(
    'SELECT ciphertext, enabled FROM user_secrets WHERE user_id = $1 AND provider = $2 AND key_name = $3',
    [userId, provider, keyName],
  );
  if (!result.rows[0]?.enabled) return null;
  return decryptManagedSecret(result.rows[0]);
}