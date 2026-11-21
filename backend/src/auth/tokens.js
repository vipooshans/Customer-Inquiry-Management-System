import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const COOKIE_NAME = 'token';
const SESSION_HOURS = 8; // one working day

export const signToken = (user) =>
  jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: `${SESSION_HOURS}h` });

// Returns the user id, or null if the token is missing, tampered with or expired.
export function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,                 // JavaScript in the page cannot read it (limits XSS damage)
  sameSite: 'lax',                // not sent on cross-site POSTs (basic CSRF protection)
  secure: config.isProduction,    // HTTPS-only in production; plain http works locally
  path: '/',
};

export const sessionMaxAgeMs = SESSION_HOURS * 60 * 60 * 1000;
