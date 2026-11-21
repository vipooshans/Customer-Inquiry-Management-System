import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createInquiry } from '../api/inquiries.js';
import { LIMITS, validateInquiry } from '../domain/inquiryValidation.js';
import Field from '../components/Field.jsx';

const EMPTY = { customerName: '', contact: '', subject: '', description: '' };

export default function NewInquiryPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null); // { message, existingId? }
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: undefined })); // clear as they fix it
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // ignore double clicks / double Enter

    const errors = validateInquiry(values);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      document.getElementById(Object.keys(errors)[0])?.focus(); // take them to the first problem
      return;
    }

    setSubmitting(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
      const inquiry = await createInquiry(trimmed);
      navigate(`/inquiries/${inquiry.id}`, { state: { created: true } });
    } catch (err) {
      // The form keeps everything they typed, whatever went wrong.
      if (err.code === 'VALIDATION_ERROR' && err.details) {
        setFieldErrors(err.details);
        setFormError({ message: err.message });
      } else if (err.code === 'DUPLICATE_INQUIRY') {
        setFormError({ message: err.message, existingId: err.details?.existingId });
      } else {
        setFormError({ message: `The inquiry was not saved. ${err.message}` });
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-medium">
      <p><Link to="/inquiries">← All inquiries</Link></p>
      <h1>New inquiry</h1>

      {formError && (
        <div className="alert alert-error" role="alert">
          {formError.message}
          {formError.existingId && (
            <> <Link to={`/inquiries/${formError.existingId}`}>Open the existing inquiry</Link></>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="form">
        <Field label="Customer name" name="customerName" value={values.customerName}
          error={fieldErrors.customerName} onChange={handleChange} maxLength={LIMITS.customerName} autoFocus />
        <Field label="Contact" name="contact" value={values.contact} error={fieldErrors.contact}
          onChange={handleChange} maxLength={LIMITS.contact} hint="Email address or phone number." />
        <Field label="Subject" name="subject" value={values.subject} error={fieldErrors.subject}
          onChange={handleChange} maxLength={LIMITS.subject} />
        <Field label="Description" name="description" multiline rows={5} value={values.description}
          error={fieldErrors.description} onChange={handleChange} maxLength={LIMITS.description}
          hint={`${values.description.length}/${LIMITS.description} characters`} />

        <div className="form-actions">
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save inquiry'}
          </button>
          <Link to="/inquiries" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
