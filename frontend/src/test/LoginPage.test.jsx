import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Fake backend: not signed in yet; /auth/login answers with `loginResponse`.
function mockApi(loginResponse) {
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/auth/me') return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    if (url === '/api/auth/login') return loginResponse();
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const loginCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login');

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/inquiries" element={<p>Inquiry list</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows field errors and does not call the API when submitted empty', async () => {
    const fetchMock = mockApi(() => json(200, {}));
    renderLogin();

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(loginCalls(fetchMock)).toHaveLength(0);
  });

  it('shows the server message on wrong credentials and lets the user retry', async () => {
    mockApi(() => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }));
    renderLogin();

    await userEvent.type(await screen.findByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('goes to the inquiry list after a successful sign-in', async () => {
    mockApi(() => json(200, { user: { id: 1, email: 'alice@example.com', name: 'Alice', role: 'staff' } }));
    renderLogin();

    await userEvent.type(await screen.findByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Inquiry list')).toBeInTheDocument();
  });
});
