import { z } from 'zod';
import { STATUSES } from './status.js';

// Contact must look like an email address or a phone number. Deliberately loose:
// we only want to catch obvious typos, not validate every format in the world.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
export const isValidContact = (value) => {
  if (EMAIL_RE.test(value)) return true;
  return PHONE_RE.test(value) && value.replace(/\D/g, '').length >= 7;
};

// Builds a required, trimmed string with friendly messages.
const text = (label, min, max) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const createInquirySchema = z.object({
  customerName: text('Customer name', 1, 100),
  contact: text('Contact', 1, 150).refine(isValidContact, 'Enter an email address or a phone number.'),
  subject: text('Subject', 3, 150),
  description: text('Description', 1, 2000),
});

export const statusChangeSchema = z.object({
  status: z.enum(STATUSES, { error: 'Status must be one of: new, in_progress, resolved.' }),
  version: z.number({ error: 'Version is required.' }).int().positive(),
  note: z
    .string()
    .trim()
    .max(500, 'Note must be at most 500 characters.')
    .optional()
    .transform((v) => (v ? v : null)),
});

export const listQuerySchema = z.object({
  status: z.enum(STATUSES, { error: 'Status filter must be one of: new, in_progress, resolved.' }).optional(),
  q: z.string().trim().max(100, 'Search text must be at most 100 characters.').optional(),
});
