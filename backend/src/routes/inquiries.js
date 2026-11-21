import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../validation.js';
import { parseId } from '../errors.js';
import { createInquirySchema, listQuerySchema, statusChangeSchema } from '../domain/inquirySchemas.js';
import * as inquiries from '../services/inquiries.js';

export const inquiriesRouter = Router();

// Every inquiry route requires a signed-in user (401 otherwise).
inquiriesRouter.use(requireAuth);

// GET /api/inquiries?status=new&q=acme -> { inquiries: [...] }, newest first
inquiriesRouter.get('/', asyncHandler(async (req, res) => {
  const filters = validate(listQuerySchema, {
    status: req.query.status || undefined,
    q: typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q : undefined,
  });
  res.json({ inquiries: await inquiries.listInquiries(req.user, filters) });
}));

// POST /api/inquiries { customerName, contact, subject, description } -> 201 { inquiry }
inquiriesRouter.post('/', asyncHandler(async (req, res) => {
  const data = validate(createInquirySchema, req.body);
  const inquiry = await inquiries.createInquiry(req.user, data);
  res.status(201).location(`/api/inquiries/${inquiry.id}`).json({ inquiry });
}));

// GET /api/inquiries/:id -> { inquiry } including its status history (events)
inquiriesRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  res.json({ inquiry: await inquiries.getInquiry(req.user, id) });
}));

// PATCH /api/inquiries/:id/status { status, version, note? } -> { inquiry }
inquiriesRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id); // checked before the body, so a bad id is always 400
  const change = validate(statusChangeSchema, req.body);
  res.json({ inquiry: await inquiries.changeStatus(req.user, id, change) });
}));
