import pg from 'pg';
import { config } from '../config.js';

// One shared connection pool for the whole process.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Convenience wrapper: query('SELECT ... WHERE id = $1', [id])
export const query = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN/COMMIT on one connection; rolls back if fn throws.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
