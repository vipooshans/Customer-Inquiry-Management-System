import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../api/client.js';

// The fetch wrapper turns server errors into ApiError objects pages can branch on.
describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns the server error shape into an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Bad input', details: { subject: 'Required' } } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )));

    const err = await apiFetch('/inquiries', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ subject: 'Required' });
  });
});
