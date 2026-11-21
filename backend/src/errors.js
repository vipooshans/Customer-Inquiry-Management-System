// Throw these from routes/services. The error handler turns them into
// { error: { code, message, details? } } with the right HTTP status.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found.`);
export const invalidId = () => new HttpError(400, 'INVALID_ID', 'The id must be a positive integer.');

// Route params arrive as strings. Accept only plain positive integers that fit in
// a Postgres INTEGER, so "abc", "1.5", "-3" or "99999999999" never reach SQL.
const MAX_INT = 2147483647;
export function parseId(raw) {
  if (!/^\d{1,10}$/.test(raw)) throw invalidId();
  const id = Number(raw);
  if (id < 1 || id > MAX_INT) throw invalidId();
  return id;
}
