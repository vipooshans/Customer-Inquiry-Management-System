import { query } from '../db/pool.js';
import { unauthenticated } from '../errors.js';
import { COOKIE_NAME, verifyToken } from '../auth/tokens.js';
import { asyncHandler } from './asyncHandler.js';

// Put this in front of any route that needs a signed-in user.
// On success sets req.user = { id, email, name, role }; otherwise responds 401.
//
// The user is re-loaded from the database on every request, rather than trusting
// the token alone, so a deleted account or changed role takes effect immediately.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const userId = verifyToken(req.cookies?.[COOKIE_NAME]);
  if (!userId) throw unauthenticated();

  const { rows } = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
  if (rows.length === 0) throw unauthenticated();

  req.user = rows[0];
  next();
});
