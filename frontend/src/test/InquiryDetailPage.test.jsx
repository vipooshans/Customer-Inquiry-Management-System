import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InquiryDetailPage from '../pages/InquiryDetailPage.jsx';
import { apiError, json, mockApi, renderAt, sampleInquiry } from './helpers.jsx';

const renderDetail = (id = 7) => renderAt(`/inquiries/${id}`, '/inquiries/:id', <InquiryDetailPage />);

describe('InquiryDetailPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers only the allowed next steps for the current status', async () => {
    mockApi({ 'GET /api/inquiries/7': () => json(200, { inquiry: sampleInquiry({ status: 'resolved' }) }) });
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument();
  });

  it('changes the status and shows it in the history', async () => {
    const updated = sampleInquiry({
      status: 'in_progress', version: 2,
      events: [
        { id: 2, fromStatus: 'new', toStatus: 'in_progress', note: 'Called back', actor: { id: 1, name: 'Alice Staff' }, createdAt: '2026-11-20T10:00:00Z' },
        ...sampleInquiry().events,
      ],
    });
    const fetchMock = mockApi({
      'GET /api/inquiries/7': () => json(200, { inquiry: sampleInquiry() }),
      'PATCH /api/inquiries/7/status': () => json(200, { inquiry: updated }),
    });
    const user = userEvent.setup();
    renderDetail();

    await user.type(await screen.findByLabelText(/Note/), 'Called back');
    await user.click(screen.getByRole('button', { name: 'Start working' }));

    expect(await screen.findByText('Status changed to In progress.')).toBeInTheDocument();
    expect(screen.getByText('Called back', { selector: '.history-note' })).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ status: 'in_progress', version: 1, note: 'Called back' });
  });

  it('explains a stale tab: shows the newer status from the server and keeps the note', async () => {
    const newer = sampleInquiry({ status: 'resolved', version: 3 });
    mockApi({
      'GET /api/inquiries/7': () => json(200, { inquiry: sampleInquiry() }),
      'PATCH /api/inquiries/7/status': () => apiError(409, 'STALE_VERSION',
        'This inquiry was changed by someone else since you opened it.', { current: newer }),
    });
    const user = userEvent.setup();
    renderDetail();

    await user.type(await screen.findByLabelText(/Note/), 'My note');
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('updated elsewhere and is now "Resolved"');
    expect(screen.getByText('Resolved', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Note/)).toHaveValue('My note');
  });

  it('shows a not-found page for an inquiry the user cannot see', async () => {
    mockApi({ 'GET /api/inquiries/99': () => apiError(404, 'NOT_FOUND', 'Inquiry not found.') });
    renderDetail(99);

    expect(await screen.findByRole('heading', { name: 'Inquiry not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to inquiries' })).toBeInTheDocument();
  });
});
