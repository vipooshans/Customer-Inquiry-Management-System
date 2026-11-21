import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Guards the workspace routes. This only improves UX; the real protection is
// the backend returning 401 on every /api/inquiries request without a session.
export default function RequireAuth({ children }) {
  const { user, status, signedOut, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p className="page muted" role="status">Loading…</p>;
  }

  if (status === 'error') {
    return (
      <main className="page">
        <div className="alert alert-error" role="alert">
          Could not reach the server. Check that the API is running and try again.
        </div>
        <button className="btn" onClick={retry}>Retry</button>
      </main>
    );
  }

  if (!user) {
    // Remember where they were going (e.g. a direct link to an inquiry) so login
    // can send them back, unless they just signed out on purpose.
    return <Navigate to="/login" replace state={signedOut ? undefined : { from: location }} />;
  }

  return children;
}
