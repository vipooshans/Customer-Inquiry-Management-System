import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, signIn, validInquiry } from './helpers.js';

let alice, bob, maya;
beforeAll(async () => {
  [alice, bob, maya] = await Promise.all([
    signIn('alice@example.com'),
    signIn('bob@example.com'),
    signIn('maya@example.com'),
  ]);
});

const create = (agent, body = validInquiry()) => agent.post('/api/inquiries').send(body);

describe('authentication is enforced by the API', () => {
  it.each([
    ['get', '/api/inquiries'],
    ['post', '/api/inquiries'],
    ['get', '/api/inquiries/1'],
    ['patch', '/api/inquiries/1/status'],
  ])('%s %s without a session -> 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/inquiries (validation)', () => {
  it('creates an inquiry with status "new" and a "created" history event', async () => {
    const res = await create(alice, validInquiry({ customerName: '  Jane  ' }));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/inquiries/${res.body.inquiry.id}`);
    expect(res.body.inquiry).toMatchObject({ customerName: 'Jane', status: 'new', version: 1 });
    expect(res.body.inquiry.events).toHaveLength(1);
    expect(res.body.inquiry.events[0]).toMatchObject({ fromStatus: null, toStatus: 'new' });
  });

  it('rejects missing and invalid fields with a message per field', async () => {
    const res = await create(alice, { customerName: '   ', contact: 'not a contact', subject: 'Hi' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({
      customerName: 'Customer name is required.',
      contact: 'Enter an email address or a phone number.',
      subject: 'Subject must be at least 3 characters.',
      description: 'Description is required.',
    });
  });

  it('accepts a phone number as contact', async () => {
    const res = await create(alice, validInquiry({ contact: '+94 77 123 4567' }));
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate open inquiry (same contact + subject) and points to the original', async () => {
    const body = validInquiry();
    const first = await create(alice, body);
    const second = await create(alice, { ...body, contact: body.contact.toUpperCase(), subject: ` ${body.subject} ` });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_INQUIRY');
    expect(second.body.error.details).toEqual({ existingId: first.body.inquiry.id });
  });
});

describe('access rule: staff see only their own inquiries, managers see all', () => {
  let alicesInquiry;
  beforeAll(async () => {
    alicesInquiry = (await create(alice, validInquiry({ customerName: 'Owned By Alice' }))).body.inquiry;
  });

  it('returns 404 (not 403) when a staff member opens someone else\'s inquiry by direct link', async () => {
    const res = await bob.get(`/api/inquiries/${alicesInquiry.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not let a staff member change someone else\'s inquiry', async () => {
    const res = await bob
      .patch(`/api/inquiries/${alicesInquiry.id}/status`)
      .send({ status: 'in_progress', version: alicesInquiry.version });
    expect(res.status).toBe(404);

    const unchanged = await alice.get(`/api/inquiries/${alicesInquiry.id}`);
    expect(unchanged.body.inquiry.status).toBe('new');
  });

  it('leaves other people\'s inquiries out of the list', async () => {
    const bobsList = (await bob.get('/api/inquiries')).body.inquiries;
    expect(bobsList.find((i) => i.id === alicesInquiry.id)).toBeUndefined();
    expect(bobsList.every((i) => i.owner.name === 'Bob Staff')).toBe(true);
  });

  it('lets a manager see and open any inquiry', async () => {
    const list = (await maya.get('/api/inquiries')).body.inquiries;
    expect(list.some((i) => i.id === alicesInquiry.id)).toBe(true);
    expect((await maya.get(`/api/inquiries/${alicesInquiry.id}`)).status).toBe(200);
  });
});

describe('GET /api/inquiries filters', () => {
  it('filters by status and searches name, contact and subject', async () => {
    const target = (await create(bob, validInquiry({ customerName: 'Zebra Holdings', contact: '0771234567' }))).body.inquiry;

    const byName = (await bob.get('/api/inquiries?q=zebra')).body.inquiries;
    expect(byName.map((i) => i.id)).toEqual([target.id]);

    const byStatus = (await bob.get('/api/inquiries?status=resolved')).body.inquiries;
    expect(byStatus.find((i) => i.id === target.id)).toBeUndefined();
  });

  it('treats % in the search as literal text, not a wildcard', async () => {
    const res = await bob.get('/api/inquiries?q=%25');
    expect(res.status).toBe(200);
    expect(res.body.inquiries).toEqual([]);
  });

  it('rejects an unknown status filter', async () => {
    const res = await bob.get('/api/inquiries?status=closed');
    expect(res.status).toBe(400);
    expect(res.body.error.details.status).toBeDefined();
  });
});

describe('GET /api/inquiries/:id with bad ids', () => {
  it.each(['abc', '1.5', '-1', '0', '99999999999'])('"%s" -> 400 INVALID_ID', async (id) => {
    const res = await alice.get(`/api/inquiries/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('a well-formed id that does not exist -> 404', async () => {
    const res = await alice.get('/api/inquiries/999999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/inquiries/:id/status (lifecycle rules)', () => {
  const change = (agent, inquiry, status, extra = {}) =>
    agent.patch(`/api/inquiries/${inquiry.id}/status`).send({ status, version: inquiry.version, ...extra });

  it('moves new -> in progress -> resolved -> in progress (reopen), recording each step', async () => {
    let inquiry = (await create(alice)).body.inquiry;

    for (const status of ['in_progress', 'resolved', 'in_progress']) {
      const res = await change(alice, inquiry, status, { note: status === 'resolved' ? 'Rebooked for Friday' : undefined });
      expect(res.status).toBe(200);
      inquiry = res.body.inquiry;
      expect(inquiry.status).toBe(status);
    }

    expect(inquiry.version).toBe(4);
    expect(inquiry.events.map((e) => e.toStatus)).toEqual(['in_progress', 'resolved', 'in_progress', 'new']);
    expect(inquiry.events[1].note).toBe('Rebooked for Friday');
  });

  it('rejects in progress -> new with 409 INVALID_TRANSITION and leaves the record unchanged', async () => {
    const created = (await create(alice)).body.inquiry;
    const started = (await change(alice, created, 'in_progress')).body.inquiry;

    const res = await change(alice, started, 'new');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'in_progress', to: 'new' } });

    const after = (await alice.get(`/api/inquiries/${created.id}`)).body.inquiry;
    expect(after).toMatchObject({ status: 'in_progress', version: 2 });
  });

  it('rejects "changing" to the current status', async () => {
    const created = (await create(alice)).body.inquiry;
    const res = await change(alice, created, 'new');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('The inquiry is already new.');
  });

  it('rejects a stale version (two tabs) with 409 STALE_VERSION and the current record', async () => {
    const created = (await create(alice)).body.inquiry;
    await change(alice, created, 'in_progress'); // "tab 1" saves first

    const res = await change(alice, created, 'resolved'); // "tab 2" still has version 1
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_VERSION');
    expect(res.body.error.details.current).toMatchObject({ status: 'in_progress', version: 2 });
  });

  it('validates the body', async () => {
    const created = (await create(alice)).body.inquiry;
    const res = await alice.patch(`/api/inquiries/${created.id}/status`).send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['status', 'version']);
  });
});
