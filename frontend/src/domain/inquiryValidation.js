// Mirrors backend/src/domain/inquirySchemas.js so users get instant feedback.
// The server repeats every check; this is for convenience, not protection.
export const LIMITS = { customerName: 100, contact: 150, subject: 150, description: 2000 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;
export const isValidContact = (v) =>
  EMAIL_RE.test(v) || (PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 7);

function checkText(errors, field, label, value, min, max) {
  const v = value.trim();
  if (!v) errors[field] = `${label} is required.`;
  else if (v.length < min) errors[field] = `${label} must be at least ${min} characters.`;
  else if (v.length > max) errors[field] = `${label} must be at most ${max} characters.`;
}

// Returns { field: message } for every problem; empty object means valid.
export function validateInquiry(values) {
  const errors = {};
  checkText(errors, 'customerName', 'Customer name', values.customerName, 1, LIMITS.customerName);
  checkText(errors, 'contact', 'Contact', values.contact, 1, LIMITS.contact);
  if (!errors.contact && !isValidContact(values.contact.trim())) {
    errors.contact = 'Enter an email address or a phone number.';
  }
  checkText(errors, 'subject', 'Subject', values.subject, 3, LIMITS.subject);
  checkText(errors, 'description', 'Description', values.description, 1, LIMITS.description);
  return errors;
}
