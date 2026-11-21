import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { SEED_PASSWORD } from '../src/db/seed.js';

const app = createApp();
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/login', () => {
  it('signs in a seeded user and sets an httpOnly cookie', async () => {
    const res = await login('  Alice@Example.com ', SEED_PASSWORD); // trimmed + case-insensitive

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'alice@example.com', role: 'staff' });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=.+HttpOnly/);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await login('alice@example.com', 'nope');
    const unknownEmail = await login('nobody@example.com', SEED_PASSWORD);

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('rejects missing fields with per-field messages', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ email: 'Email is required.', password: 'Password is required.' });
  });
});

describe('GET /api/auth/me (backend-enforced authentication)', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: '1' }, 'attacker-secret');
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${forged}`);
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid session, and 401 after logout', async () => {
    const agent = request.agent(app); // keeps cookies between requests, like a browser
    await agent.post('/api/auth/login').send({ email: 'maya@example.com', password: SEED_PASSWORD });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'maya@example.com', role: 'manager' });

    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
