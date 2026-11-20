import { Router } from 'express';

export const inquiriesRouter = Router();

// TODO (PLAN.md "API" + "Decisions"):
//   GET    /            list with ?status= & ?q=, access rule in the WHERE clause
//   POST   /            validate (zod), duplicate check, insert inquiry + 'created' event
//   GET    /:id         parse id (400 INVALID_ID), access rule, 404 if not visible
//   PATCH  /:id/status  transition check (409), version check (409 STALE_VERSION), insert event
// Mount requireAuth on this router once it exists.
// Express 4 does not catch rejected promises: wrap async handlers or use try/catch + next(err).
