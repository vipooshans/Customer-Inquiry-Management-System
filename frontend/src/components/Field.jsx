// Label + input (or textarea) + inline error, wired up for screen readers.
export default function Field({ label, name, error, hint, multiline = false, ...inputProps }) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;
  const Input = multiline ? 'textarea' : 'input';
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <Input id={name} name={name} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      {hint && <p id={hintId} className="field-hint">{hint}</p>}
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
