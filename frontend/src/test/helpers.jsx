import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status, code, message, details) => json(status, { error: { code, message, details } });

// Replaces fetch with a tiny fake backend. `routes` maps "METHOD /path" to a
// function returning a Response; anything else fails the test loudly.
export function mockApi(routes) {
  const fetchMock = vi.fn(async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler(init.body ? JSON.parse(init.body) : undefined);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const callsTo = (fetchMock, method, url) =>
  fetchMock.mock.calls.filter(([u, init = {}]) => u === url && (init.method ?? 'GET') === method);

export function renderAt(path, routePath, element, extraRoutes = null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        {extraRoutes}
      </Routes>
    </MemoryRouter>,
  );
}

export const sampleInquiry = (overrides = {}) => ({
  id: 7,
  customerName: 'Jane Customer',
  contact: 'jane@example.com',
  subject: 'Booking change',
  description: 'Move to Friday please.',
  status: 'new',
  version: 1,
  owner: { id: 1, name: 'Alice Staff' },
  createdAt: '2026-11-20T09:00:00Z',
  updatedAt: '2026-11-20T09:00:00Z',
  events: [{ id: 1, fromStatus: null, toStatus: 'new', note: null, actor: { id: 1, name: 'Alice Staff' }, createdAt: '2026-11-20T09:00:00Z' }],
  ...overrides,
});
