import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { validate } from '../validation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { COOKIE_NAME, cookieOptions, sessionMaxAgeMs, signToken } from '../auth/tokens.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().min(1, 'Email is required.'),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

// Compared against when the email is unknown, so a wrong email takes about as
// long as a wrong password and response timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const publicUser = ({ id, email, name, role }) => ({ id, email, name, role });

// POST /api/auth/login  { email, password } -> 200 user + Set-Cookie
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = validate(loginSchema, req.body);

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  // Same message for "no such email" and "wrong password": don't reveal which.
  if (!user || !passwordOk) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  res.cookie(COOKIE_NAME, signToken(user), { ...cookieOptions, maxAge: sessionMaxAgeMs });
  res.json({ user: publicUser(user) });
}));

// POST /api/auth/logout -> 204. Clears the cookie; safe to call when not signed in.
authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
});

// GET /api/auth/me -> 200 current user, or 401. The frontend calls this on load.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});
