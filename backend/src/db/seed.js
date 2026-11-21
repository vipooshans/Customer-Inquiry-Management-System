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

// A few example inquiries so the app isn't empty on first sign-in (CLI only;
// the tests start from an empty table).
const SAMPLE_INQUIRIES = [
  ['alice@example.com', 'Nimal Perera', 'nimal@example.com', 'Booking change', 'Wants to move Saturday booking to Sunday.', 'new'],
  ['alice@example.com', 'Kavya Raj', '+94 77 555 0101', 'Invoice copy', 'Needs a copy of the March invoice for accounts.', 'in_progress'],
  ['bob@example.com', 'Sam Fernando', 'sam@example.com', 'Delivery delay', 'Order has not arrived after 5 days.', 'new'],
  ['bob@example.com', 'Priya N', 'priya@example.com', 'Refund request', 'Asked for a refund for a cancelled session.', 'resolved'],
];

export async function seed({ withSamples = false } = {}) {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.email, u.name, hash, u.role],
    );
  }
  if (withSamples) await seedSamples();
}

async function seedSamples() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM inquiries');
  if (rows[0].n > 0) return; // never add samples on top of real data
  for (const [email, name, contact, subject, description, status] of SAMPLE_INQUIRIES) {
    const ins = await pool.query(
      `INSERT INTO inquiries (customer_name, contact, subject, description, status, owner_id)
       SELECT $1, $2, $3, $4, $5, id FROM users WHERE email = $6 RETURNING id, owner_id`,
      [name, contact, subject, description, status, email],
    );
    const { id, owner_id: ownerId } = ins.rows[0];
    await pool.query(
      `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status) VALUES ($1, $2, NULL, 'new')`,
      [id, ownerId],
    );
    if (status !== 'new') {
      await pool.query(
        `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status) VALUES ($1, $2, 'new', $3)`,
        [id, ownerId, status],
      );
    }
  }
  console.log(`added ${SAMPLE_INQUIRIES.length} sample inquiries`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ withSamples: true })
    .then(() => console.log(`seeded ${SEED_USERS.length} users (password: ${SEED_PASSWORD})`))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
