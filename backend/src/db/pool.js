import pg from 'pg';
import { config } from '../config.js';

// One shared connection pool for the whole process.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Convenience wrapper: query('SELECT ... WHERE id = $1', [id])
export const query = (text, params) => pool.query(text, params);
