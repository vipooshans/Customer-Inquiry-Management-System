import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Dashboard shell for signed-in pages: fixed sidebar + top bar; the current page
// renders in <Outlet />. On narrow screens the sidebar becomes a top strip (CSS).
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout(); // RequireAuth then redirects to /login
  }

  // "Inquiries" stays highlighted on the list and on a single inquiry's page.
  const onList = pathname.startsWith('/inquiries') && pathname !== '/inquiries/new';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/inquiries" className="brand">
          <span className="brand-mark" aria-hidden="true"><ChatIcon /></span>
          <span className="brand-name">Inquiry Desk</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <p className="nav-heading">Workspace</p>
          <NavLink to="/inquiries" end className={() => `nav-link${onList ? ' active' : ''}`}>
            <ListIcon /> Inquiries
          </NavLink>
          <NavLink to="/inquiries/new" className="nav-link">
            <PlusIcon /> New inquiry
          </NavLink>
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <p className="topbar-title">Customer inquiries</p>
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
            <span className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role === 'manager' ? 'Manager' : 'Staff'}</span>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Small inline icons (no icon library needed).
const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};
const ChatIcon = () => (
  <svg {...svgProps}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
);
const ListIcon = () => (
  <svg {...svgProps}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
const PlusIcon = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
);
