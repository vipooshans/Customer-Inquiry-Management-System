import { apiFetch } from './client.js';

// One function per inquiry endpoint. Each resolves to plain data or throws ApiError.
export function listInquiries({ status, q } = {}, { signal } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  return apiFetch(`/inquiries${qs ? `?${qs}` : ''}`, { signal }).then((d) => d.inquiries);
}

export const getInquiry = (id, { signal } = {}) =>
  apiFetch(`/inquiries/${encodeURIComponent(id)}`, { signal }).then((d) => d.inquiry);

export const createInquiry = (data) =>
  apiFetch('/inquiries', { method: 'POST', body: data }).then((d) => d.inquiry);

export const changeStatus = (id, { status, version, note }) =>
  apiFetch(`/inquiries/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status, version, note: note || undefined },
  }).then((d) => d.inquiry);
