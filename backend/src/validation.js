import { HttpError } from './errors.js';

// Parses `data` with a zod schema. On failure throws 400 VALIDATION_ERROR with
// details as { fieldName: firstMessage }, which the frontend shows next to each input.
export function validate(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;

  const details = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] ?? '_root';
    if (!details[field]) details[field] = issue.message;
  }
  throw new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', details);
}
