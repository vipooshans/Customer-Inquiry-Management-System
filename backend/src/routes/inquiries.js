import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

export const inquiriesRouter = Router();

// Every inquiry route requires a signed-in user (401 otherwise).
inquiriesRouter.use(requireAuth);

// TODO (PLAN.md "API" + "Decisions"):
//   GET    /            list with ?status= & ?q=, access rule in the WHERE clause
//   POST   /            validate (zod), duplicate check, insert inquiry + 'created' event
//   GET    /:id         parse id (400 INVALID_ID), access rule, 404 if not visible
//   PATCH  /:id/status  transition check (409), version check (409 STALE_VERSION), insert event
// Wrap async handlers in asyncHandler (src/middleware/asyncHandler.js).
