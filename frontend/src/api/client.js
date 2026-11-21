// Thin fetch wrapper. Every failed request throws an ApiError carrying the
// server's { error: { code, message, details } } so pages can branch on `code`
// (e.g. VALIDATION_ERROR -> field errors, STALE_VERSION -> reload banner).
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Called when any non-auth request gets a 401 (e.g. the session expired while the
// app was open). AuthProvider registers a handler that signs the user out locally.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // /auth/* handle their own 401s (wrong password, not signed in yet).
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return data;
}
