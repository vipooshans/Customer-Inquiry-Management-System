// All inquiry SQL lives here. Routes handle HTTP; this module handles data and rules.
//
// ACCESS RULE: staff can see and change only inquiries they own (they created them);
// managers can see and change all of them. The rule is part of every WHERE clause,
// so a query can never return a row the user isn't allowed to see. A row that
// exists but belongs to someone else is indistinguishable from one that doesn't
// exist (both -> 404), so IDs can't be probed.
import { query, withTransaction } from '../db/pool.js';
import { HttpError, notFound } from '../errors.js';
import { canTransition } from '../domain/status.js';

const LIST_LIMIT = 200;

// Adds the access rule to a parameter list and returns the SQL fragment.
function accessRule(user, params, alias = 'i') {
  params.push(user.id, user.role);
  return `(${alias}.owner_id = $${params.length - 1} OR $${params.length} = 'manager')`;
}

// Escapes LIKE wildcards so a search for "50%" matches the literal text.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const INQUIRY_COLUMNS = `
  i.id, i.customer_name, i.contact, i.subject, i.description, i.status, i.version,
  i.created_at, i.updated_at, i.owner_id, u.name AS owner_name`;

// DB row (snake_case) -> API shape (camelCase).
const toInquiry = (r) => ({
  id: r.id,
  customerName: r.customer_name,
  contact: r.contact,
  subject: r.subject,
  description: r.description,
  status: r.status,
  version: r.version,
  owner: { id: r.owner_id, name: r.owner_name },
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toEvent = (r) => ({
  id: r.id,
  fromStatus: r.from_status,
  toStatus: r.to_status,
  note: r.note,
  actor: { id: r.actor_id, name: r.actor_name },
  createdAt: r.created_at,
});

export async function listInquiries(user, { status, q }) {
  const params = [];
  const where = [accessRule(user, params)];
  if (status) {
    params.push(status);
    where.push(`i.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const p = `$${params.length}`;
    where.push(`(i.customer_name ILIKE ${p} OR i.contact ILIKE ${p} OR i.subject ILIKE ${p})`);
  }
  const { rows } = await query(
    `SELECT ${INQUIRY_COLUMNS}
       FROM inquiries i JOIN users u ON u.id = i.owner_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ${LIST_LIMIT}`,
    params,
  );
  return rows.map(toInquiry);
}

// Loads one inquiry plus its history, or null if it doesn't exist / isn't visible.
async function findVisible(db, user, id) {
  const params = [id];
  const { rows } = await db.query(
    `SELECT ${INQUIRY_COLUMNS}
       FROM inquiries i JOIN users u ON u.id = i.owner_id
      WHERE i.id = $1 AND ${accessRule(user, params)}`,
    params,
  );
  if (rows.length === 0) return null;

  const events = await db.query(
    `SELECT e.*, u.name AS actor_name
       FROM inquiry_events e JOIN users u ON u.id = e.actor_id
      WHERE e.inquiry_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [id],
  );
  return { ...toInquiry(rows[0]), events: events.rows.map(toEvent) };
}

export async function getInquiry(user, id) {
  const inquiry = await findVisible({ query }, user, id);
  if (!inquiry) throw notFound('Inquiry');
  return inquiry;
}

// DUPLICATE POLICY: the same staff member can't have two *open* inquiries with the
// same contact and subject (trimmed, case-insensitive). That catches double
// submits and accidental re-entry without blocking a returning customer whose
// earlier inquiry was resolved.
export async function createInquiry(user, data) {
  return withTransaction(async (db) => {
    // Serialise creates per owner so two simultaneous identical submits can't
    // both pass the duplicate check. The lock is released at COMMIT.
    await db.query('SELECT pg_advisory_xact_lock($1)', [user.id]);

    const dup = await db.query(
      `SELECT id FROM inquiries
        WHERE owner_id = $1 AND status <> 'resolved'
          AND lower(contact) = lower($2) AND lower(subject) = lower($3)
        LIMIT 1`,
      [user.id, data.contact, data.subject],
    );
    if (dup.rows.length > 0) {
      throw new HttpError(409, 'DUPLICATE_INQUIRY',
        'An open inquiry with this contact and subject already exists.',
        { existingId: dup.rows[0].id });
    }

    const { rows } = await db.query(
      `INSERT INTO inquiries (customer_name, contact, subject, description, owner_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.customerName, data.contact, data.subject, data.description, user.id],
    );
    const id = rows[0].id;
    await db.query(
      `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status) VALUES ($1, $2, NULL, 'new')`,
      [id, user.id],
    );
    return findVisible(db, user, id);
  });
}

// STALE DATA: the client sends the version it last saw. If someone changed the
// inquiry since, we refuse with 409 STALE_VERSION and send back the current
// record, so the UI can show what changed instead of silently overwriting it.
export async function changeStatus(user, id, { status, version, note }) {
  return withTransaction(async (db) => {
    const params = [id];
    const { rows } = await db.query(
      `SELECT i.status, i.version FROM inquiries i
        WHERE i.id = $1 AND ${accessRule(user, params)}
        FOR UPDATE`,
      params,
    );
    if (rows.length === 0) throw notFound('Inquiry');
    const current = rows[0];

    if (current.version !== version) {
      throw new HttpError(409, 'STALE_VERSION',
        'This inquiry was changed by someone else since you opened it.',
        { current: await findVisible(db, user, id) });
    }
    if (!canTransition(current.status, status)) {
      throw new HttpError(409, 'INVALID_TRANSITION',
        current.status === status
          ? `The inquiry is already ${status.replace('_', ' ')}.`
          : `Cannot change status from ${current.status.replace('_', ' ')} to ${status.replace('_', ' ')}.`,
        { from: current.status, to: status });
    }

    await db.query(
      `UPDATE inquiries SET status = $1, version = version + 1, updated_at = now() WHERE id = $2`,
      [status, id],
    );
    await db.query(
      `INSERT INTO inquiry_events (inquiry_id, actor_id, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, user.id, current.status, status, note],
    );
    return findVisible(db, user, id);
  });
}
