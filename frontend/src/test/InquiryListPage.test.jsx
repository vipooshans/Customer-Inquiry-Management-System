import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InquiryListPage from '../pages/InquiryListPage.jsx';
import { apiError, json, mockApi, renderAt, sampleInquiry } from './helpers.jsx';

const renderList = (path = '/inquiries') => renderAt(path, '/inquiries', <InquiryListPage />);

describe('InquiryListPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a loading message, then the inquiries with their status', async () => {
    mockApi({ 'GET /api/inquiries': () => json(200, { inquiries: [sampleInquiry({ status: 'in_progress' })] }) });
    renderList();

    expect(screen.getByRole('status')).toHaveTextContent('Loading inquiries');
    expect(await screen.findByRole('link', { name: 'Booking change' })).toHaveAttribute('href', '/inquiries/7');
    expect(screen.getByText('In progress', { selector: '.badge' })).toBeInTheDocument();
  });

  it('shows a "no inquiries yet" state with a call to action when there are none', async () => {
    mockApi({ 'GET /api/inquiries': () => json(200, { inquiries: [] }) });
    renderList();

    expect(await screen.findByText('No inquiries yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New inquiry' })).toHaveLength(2);
  });

  it('shows "no matches" with a way to clear filters when a filter finds nothing', async () => {
    mockApi({
      'GET /api/inquiries?status=resolved': () => json(200, { inquiries: [] }),
      'GET /api/inquiries': () => json(200, { inquiries: [sampleInquiry()] }),
    });
    const user = userEvent.setup();
    renderList('/inquiries?status=resolved');

    expect(await screen.findByText('No inquiries match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('link', { name: 'Booking change' })).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    let attempt = 0;
    mockApi({
      'GET /api/inquiries': () => (++attempt === 1
        ? apiError(500, 'INTERNAL', 'Something went wrong. Please try again.')
        : json(200, { inquiries: [sampleInquiry()] })),
    });
    const user = userEvent.setup();
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load inquiries');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Booking change' })).toBeInTheDocument();
  });
});
