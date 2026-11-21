import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import NewInquiryPage from '../pages/NewInquiryPage.jsx';
import { apiError, callsTo, json, mockApi, renderAt, sampleInquiry } from './helpers.jsx';

function renderForm() {
  renderAt('/inquiries/new', '/inquiries/new', <NewInquiryPage />,
    <Route path="/inquiries/:id" element={<p>Detail page</p>} />);
}

async function fillValidForm(user) {
  await user.type(screen.getByLabelText('Customer name'), 'Jane Customer');
  await user.type(screen.getByLabelText('Contact'), 'jane@example.com');
  await user.type(screen.getByLabelText('Subject'), 'Booking change');
  await user.type(screen.getByLabelText('Description'), 'Move to Friday please.');
}

describe('NewInquiryPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an error next to each missing field and does not call the API', async () => {
    const fetchMock = mockApi({});
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Contact'), 'not-a-contact');
    await user.click(screen.getByRole('button', { name: 'Save inquiry' }));

    expect(screen.getByText('Customer name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter an email address or a phone number.')).toBeInTheDocument();
    expect(screen.getByText('Subject is required.')).toBeInTheDocument();
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer name')).toHaveFocus(); // first problem gets focus
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows errors the server finds next to the matching field, keeping what was typed', async () => {
    mockApi({
      'POST /api/inquiries': () => apiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.',
        { subject: 'Subject must be at most 150 characters.' }),
    });
    const user = userEvent.setup();
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save inquiry' }));

    expect(await screen.findByText('Subject must be at most 150 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Customer name')).toHaveValue('Jane Customer');
    expect(screen.getByRole('button', { name: 'Save inquiry' })).toBeEnabled();
  });

  it('links to the existing inquiry when the server reports a duplicate', async () => {
    mockApi({
      'POST /api/inquiries': () => apiError(409, 'DUPLICATE_INQUIRY',
        'An open inquiry with this contact and subject already exists.', { existingId: 42 }),
    });
    const user = userEvent.setup();
    renderForm();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Save inquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('link', { name: 'Open the existing inquiry' })).toHaveAttribute('href', '/inquiries/42');
  });

  it('sends trimmed values once, disables the button while saving, then opens the new inquiry', async () => {
    let resolve;
    const fetchMock = mockApi({
      'POST /api/inquiries': () => new Promise((r) => { resolve = r; }),
    });
    const user = userEvent.setup();
    renderForm();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Customer name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save inquiry' }));

    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    await user.click(saving); // a second click while saving does nothing

    const calls = callsTo(fetchMock, 'POST', '/api/inquiries');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body).customerName).toBe('Jane Customer');

    resolve(json(201, { inquiry: sampleInquiry() }));
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
  });
});
