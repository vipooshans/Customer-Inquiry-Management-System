import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Same rules as the backend's loginSchema. The client check gives instant
// feedback; the server check is the one that actually protects the API.
function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

export default function LoginPage() {
  const { user, status, sessionExpired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/inquiries';

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <p className="page muted" role="status">Loading…</p>;
  if (user) return <Navigate to={from} replace />; // already signed in

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: undefined })); // clear as they fix it
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && err.details) setFieldErrors(err.details);
      else setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-narrow">
      <h1>Sign in</h1>
      <p className="muted">Sign in to view and manage customer inquiries.</p>

      {sessionExpired && !formError && (
        <div className="alert alert-info" role="status">Your session has expired. Please sign in again.</div>
      )}
      {formError && <div className="alert alert-error" role="alert">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate className="form">
        <Field label="Email" name="email" type="email" autoComplete="username"
          value={values.email} error={fieldErrors.email} onChange={handleChange} autoFocus />
        <Field label="Password" name="password" type="password" autoComplete="current-password"
          value={values.password} error={fieldErrors.password} onChange={handleChange} />

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

// Label + input + inline error, wired up for screen readers.
function Field({ label, name, error, ...inputProps }) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined} {...inputProps} />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
