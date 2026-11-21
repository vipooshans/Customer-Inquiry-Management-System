import { apiFetch } from './client.js';

// One function per auth endpoint. Each returns the user object (or nothing).
export const login = (email, password) =>
  apiFetch('/auth/login', { method: 'POST', body: { email, password } }).then((d) => d.user);

export const logout = () => apiFetch('/auth/logout', { method: 'POST' });

export const fetchCurrentUser = () => apiFetch('/auth/me').then((d) => d.user);
