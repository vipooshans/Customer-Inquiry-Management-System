// Seeds test accounts. Idempotent: re-running updates them instead of failing.
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

export const SEED_PASSWORD = 'Password123!';
export const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice Staff', role: 'staff' },
  { email: 'bob@example.com', name: 'Bob Staff', role: 'staff' },
  { email: 'maya@example.com', name: 'Maya Manager', role: 'manager' },
];

export async function seed() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.email, u.name, hash, u.role],
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => console.log(`seeded ${SEED_USERS.length} users (password: ${SEED_PASSWORD})`))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
