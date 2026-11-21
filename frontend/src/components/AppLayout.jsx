import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Shared header for signed-in pages; the current page renders in <Outlet />.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout(); // RequireAuth then redirects to /login
  }

  return (
    <>
      <header className="app-header">
        <Link to="/inquiries" className="app-title">Inquiries</Link>
        <div className="app-user">
          <span>
            {user.name} <span className="muted">({user.role})</span>
          </span>
          <button className="btn btn-secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <Outlet />
    </>
  );
}
