import request from 'supertest';
import { createApp } from '../src/app.js';
import { SEED_PASSWORD } from '../src/db/seed.js';

export const app = createApp();

// Returns a supertest agent that is signed in as `email` (keeps the cookie).
export async function signIn(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: SEED_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return agent;
}

let counter = 0;
// A valid inquiry body; subjects are unique so tests don't trip the duplicate rule.
export const validInquiry = (overrides = {}) => ({
  customerName: 'Jane Customer',
  contact: 'jane@example.com',
  subject: `Booking question ${++counter}`,
  description: 'Can I move my appointment to Friday?',
  ...overrides,
});
