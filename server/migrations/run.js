import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import pool from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  // Ensure the migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.rows.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = readFileSync(join(__dirname, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrations] Applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrations] Failed: ${file}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}
