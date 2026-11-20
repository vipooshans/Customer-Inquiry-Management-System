import { Router } from 'express';

export const authRouter = Router();

// TODO (PLAN.md "API"):
//   POST /login  -> validate body, look up user by email, bcrypt.compare,
//                   sign JWT { sub: id, role }, set httpOnly cookie, return user (never the hash)
//   POST /logout -> clear cookie
//   GET  /me     -> requireAuth, return req.user
// Also write src/middleware/requireAuth.js: read cookie, jwt.verify, set req.user,
// otherwise throw unauthenticated().
