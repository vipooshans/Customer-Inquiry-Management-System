// Seeds test accounts. Idempotent: re-running updates them instead of failing.
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './pool.js';

export const SEED_PASSWORD = 'Password123!';
export const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice Staff', role: 'staff' },
  { email: 'bob@example.com', name: 'Bob Staff', role: 'staff' },
  { email: 'maya@example.com', name: 'Maya Manager', role: 'manager' },
];

// Example inquiries so the app isn't empty on first sign-in (CLI only; the tests
// start from an empty table). Each one has a realistic history:
//   hoursAgo: when it was recorded
//   steps:    status changes after that, as { to, after (hours after creation), by?, note? }
//             `by` defaults to the owner; the final step decides the current status.
// All steps follow the allowed transitions in src/domain/status.js.
const SAMPLE_INQUIRIES = [
  // Alice: 5 inquiries
  {
    owner: 'alice@example.com', hoursAgo: 2,
    customer: 'Nimal Perera', contact: 'nimal.perera@example.com',
    subject: 'Booking change',
    description: 'Wants to move his Saturday 10am booking to Sunday afternoon if a slot is free.',
    steps: [],
  },
  {
    owner: 'alice@example.com', hoursAgo: 26,
    customer: 'Kavya Raj', contact: '+94 77 555 0101',
    subject: 'Invoice copy',
    description: 'Needs a copy of the March invoice for her company accounts, addressed to Raj Holdings.',
    steps: [{ to: 'in_progress', after: 1, note: 'Asked accounts to regenerate the invoice with the company name.' }],
  },
  {
    owner: 'alice@example.com', hoursAgo: 72,
    customer: 'Dilshan Silva', contact: 'dilshan.s@example.com',
    subject: 'Wrong item delivered',
    description: 'Ordered the large coffee grinder but received the small one. Wants an exchange, not a refund.',
    steps: [
      { to: 'in_progress', after: 2, note: 'Exchange approved. Courier pickup booked for Thursday.' },
      { to: 'resolved', after: 50, note: 'Correct grinder delivered; customer confirmed by phone.' },
    ],
  },
  {
    owner: 'alice@example.com', hoursAgo: 120,
    customer: 'Anjali Fernando', contact: '+94 71 234 5678',
    subject: 'Gift voucher not received',
    description: 'Bought a gift voucher online on Monday; the email with the code never arrived.',
    steps: [
      { to: 'resolved', after: 3, note: 'Resent the voucher email; it had gone to spam.' },
      { to: 'in_progress', after: 30, note: 'Reopened: customer says the code is rejected at checkout.' },
    ],
  },
  {
    owner: 'alice@example.com', hoursAgo: 300,
    customer: 'Ruwan Jayasinghe', contact: 'ruwan@example.com',
    subject: 'Opening hours on public holiday',
    description: 'Asked whether the shop is open on the upcoming public holiday.',
    steps: [{ to: 'resolved', after: 1, note: 'Answered by email: open 9am to 1pm.' }],
  },

  // Bob: 5 inquiries
  {
    owner: 'bob@example.com', hoursAgo: 5,
    customer: 'Sam Fernando', contact: 'sam.fernando@example.com',
    subject: 'Delivery delay',
    description: 'Order #4821 has not arrived after 5 working days. Customer needs it before the weekend.',
    steps: [],
  },
  {
    owner: 'bob@example.com', hoursAgo: 30,
    customer: 'Meera Krishnan', contact: '+94 76 908 1122',
    subject: 'Catering quote for 40 people',
    description: 'Wants a quote for coffee and pastries for a 40-person office event on the 12th.',
    steps: [{ to: 'in_progress', after: 4, note: 'Sent draft menu; waiting for her to confirm numbers.' }],
  },
  {
    owner: 'bob@example.com', hoursAgo: 96,
    customer: 'Priya Nadarajah', contact: 'priya.n@example.com',
    subject: 'Refund request',
    description: 'Asked for a refund for a barista class that was cancelled by us.',
    steps: [
      { to: 'in_progress', after: 1 },
      { to: 'resolved', after: 20, by: 'maya@example.com', note: 'Refund approved and processed by manager.' },
    ],
  },
  {
    owner: 'bob@example.com', hoursAgo: 150,
    customer: 'Kasun Wickramasinghe', contact: 'kasun.w@example.com',
    subject: 'Espresso machine warranty',
    description: 'Machine bought 8 months ago leaks water from the group head. Asking if it is covered.',
    steps: [{ to: 'in_progress', after: 6, note: 'Covered under warranty. Waiting for the service centre to call back.' }],
  },
  {
    owner: 'bob@example.com', hoursAgo: 340,
    customer: 'Tharushi Bandara', contact: '+94 70 111 2233',
    subject: 'Loyalty points missing',
    description: 'Points from her last three purchases are not showing in the loyalty app.',
    steps: [{ to: 'resolved', after: 24, note: 'Points added manually; app sync issue reported to the vendor.' }],
  },

  // Maya (manager): 2 inquiries of her own
  {
    owner: 'maya@example.com', hoursAgo: 8,
    customer: 'Hemal Gunawardena', contact: 'hemal@example.com',
    subject: 'Complaint about staff service',
    description: 'Customer felt rushed at the counter on Tuesday evening and wants to speak to a manager.',
    steps: [],
  },
  {
    owner: 'maya@example.com', hoursAgo: 200,
    customer: 'Green Leaf Cafe', contact: 'orders@greenleaf.example.com',
    subject: 'Wholesale bean pricing',
    description: 'Cafe owner asking for wholesale prices on 20kg per month of house blend beans.',
    steps: [{ to: 'resolved', after: 48, note: 'Price list sent; they will order from next month.' }],
  },
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
  if (rows[0].n > 0) {
    console.log('inquiries table is not empty; skipping sample data');
    return; // never add samples on top of real data
  }

  await withTransaction(async (client) => {
    const users = await client.query('SELECT id, email FROM users');
    const userId = Object.fromEntries(users.rows.map((u) => [u.email, u.id]));
    const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600 * 1000);

    for (const s of SAMPLE_INQUIRIES) {
      const ownerId = userId[s.owner];
      const status = s.steps.at(-1)?.to ?? 'new';
      const lastChange = at(s.hoursAgo - (s.steps.at(-1)?.after ?? 0));

      const { rows: [inq] } = await client.query(
        `INSERT INTO inquiries
           (customer_name, contact, subject, description, status, owner_id, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        // version = 1 + number of status changes, as if made through the API
        [s.customer, s.contact, s.subject, s.description, status, ownerId,
          1 + s.steps.length, at(s.hoursAgo), lastChange],
      );

      const addEvent = (actorId, from, to, note, when) => client.query(
        `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [inq.id, actorId, from, to, note ?? null, when],
      );

      await addEvent(ownerId, null, 'new', null, at(s.hoursAgo)); // "recorded the inquiry"
      let from = 'new';
      for (const step of s.steps) {
        await addEvent(userId[step.by ?? s.owner], from, step.to, step.note, at(s.hoursAgo - step.after));
        from = step.to;
      }
    }
  });
  console.log(`added ${SAMPLE_INQUIRIES.length} sample inquiries`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ withSamples: true })
    .then(() => console.log(`seeded ${SEED_USERS.length} users (password: ${SEED_PASSWORD})`))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
