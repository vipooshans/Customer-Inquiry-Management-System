import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/auth.js';
import { setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

// Holds the signed-in user for the whole app.
//   status: 'loading' (asking the server who we are) | 'ready' | 'error' (server unreachable)
//   user:   the user object, or null when signed out
// The server is the source of truth: on load we ask GET /api/auth/me, because the
// httpOnly cookie can't be read from JavaScript.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const checkSession = useCallback(async () => {
    setStatus('loading');
    try {
      setUser(await authApi.fetchCurrentUser());
      setStatus('ready');
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED') {
        setUser(null);
        setStatus('ready');
      } else {
        setStatus('error'); // network/server problem: don't pretend the user is signed out
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // A protected request returned 401 mid-session: drop the user so RequireAuth
  // sends them to the login page with an explanation.
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) setSessionExpired(true);
      setUser(null);
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await authApi.login(email, password); // throws ApiError on failure
    setUser(u);
    setSessionExpired(false);
    setSignedOut(false);
    setStatus('ready');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the request fails, clear local state; the cookie expires anyway.
    }
    setSignedOut(true);
    setUser(null);
  }, []);

  const value = { user, status, sessionExpired, signedOut, login, logout, retry: checkSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
