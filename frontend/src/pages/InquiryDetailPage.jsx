import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { changeStatus, getInquiry } from '../api/inquiries.js';
import { useApi } from '../hooks/useApi.js';
import { STATUS_LABELS, actionLabel, allowedNext } from '../domain/status.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDateTime } from '../components/format.js';

export default function InquiryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { data: inquiry, error, setData, reload } = useApi((signal) => getInquiry(id, { signal }), [id]);

  // STALE DATA: re-fetch when the user comes back to this tab, so a change made in
  // another tab shows up without a manual refresh. If they save before that
  // happens, the server's version check (409 STALE_VERSION) still catches it.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  if (error && !inquiry) {
    // Invalid id, deleted record, or someone else's inquiry: the server answers the
    // same way for the last two, and so do we.
    if (error.code === 'NOT_FOUND' || error.code === 'INVALID_ID') {
      return (
        <main className="page">
          <h1>Inquiry not found</h1>
          <p className="muted">
            It may have been removed, the link may be wrong, or it may belong to another staff member.
          </p>
          <Link to="/inquiries" className="btn">Back to inquiries</Link>
        </main>
      );
    }
    return (
      <main className="page">
        <div className="alert alert-error" role="alert">
          <p>Could not load this inquiry. {error.message}</p>
          <button className="btn btn-secondary" onClick={reload}>Try again</button>
        </div>
      </main>
    );
  }
  if (!inquiry) return <main className="page"><p className="muted" role="status">Loading inquiry…</p></main>;

  return (
    <main className="page page-medium">
      <p><Link to="/inquiries">← All inquiries</Link></p>
      {location.state?.created && <div className="alert alert-success" role="status">Inquiry saved.</div>}

      <div className="page-header">
        <h1>{inquiry.subject}</h1>
        <StatusBadge status={inquiry.status} />
      </div>

      <dl className="details">
        <dt>Customer</dt><dd>{inquiry.customerName}</dd>
        <dt>Contact</dt><dd>{inquiry.contact}</dd>
        <dt>Owner</dt><dd>{inquiry.owner.name}</dd>
        <dt>Created</dt><dd>{formatDateTime(inquiry.createdAt)}</dd>
        <dt>Description</dt><dd className="pre-wrap">{inquiry.description}</dd>
      </dl>

      <StatusChanger key={inquiry.id} inquiry={inquiry} onSaved={setData} />
      <History events={inquiry.events} />
    </main>
  );
}

function StatusChanger({ inquiry, onSaved }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null); // target status while saving
  const [message, setMessage] = useState(null); // { kind: 'error'|'warning'|'success', text }

  async function handleChange(target) {
    setSaving(target);
    setMessage(null);
    try {
      const updated = await changeStatus(inquiry.id, { status: target, version: inquiry.version, note: note.trim() });
      onSaved(updated);
      setNote('');
      setMessage({ kind: 'success', text: `Status changed to ${STATUS_LABELS[updated.status]}.` });
    } catch (err) {
      if (err.code === 'STALE_VERSION' && err.details?.current) {
        // Someone else changed it first. Show their version and keep the note, so
        // the user can decide whether their change still makes sense.
        onSaved(err.details.current);
        setMessage({
          kind: 'warning',
          text: `This inquiry was updated elsewhere and is now "${STATUS_LABELS[err.details.current.status]}". `
            + 'Your change was not saved. Review the latest status and try again if needed.',
        });
      } else {
        setMessage({ kind: 'error', text: `Status not changed. ${err.message}` });
      }
    } finally {
      setSaving(null);
    }
  }

  const next = allowedNext(inquiry.status);
  return (
    <section className="card" aria-labelledby="status-heading">
      <h2 id="status-heading">Update status</h2>
      {message && (
        <div className={`alert alert-${message.kind}`} role={message.kind === 'success' ? 'status' : 'alert'}>
          {message.text}
        </div>
      )}
      <div className="field">
        <label htmlFor="note">Note <span className="muted">(optional)</span></label>
        <textarea id="note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Called the customer and rebooked for Friday" />
      </div>
      <div className="form-actions">
        {next.map((target) => (
          <button key={target} className={target === 'resolved' ? 'btn' : 'btn btn-secondary'}
            disabled={saving !== null} onClick={() => handleChange(target)}>
            {saving === target ? 'Saving…' : actionLabel(inquiry.status, target)}
          </button>
        ))}
      </div>
    </section>
  );
}

function History({ events }) {
  return (
    <section aria-labelledby="history-heading">
      <h2 id="history-heading">History</h2>
      <ol className="history">
        {events.map((e) => (
          <li key={e.id}>
            <div>
              {e.fromStatus
                ? <>{e.actor.name} changed status from <strong>{STATUS_LABELS[e.fromStatus]}</strong> to <strong>{STATUS_LABELS[e.toStatus]}</strong></>
                : <>{e.actor.name} recorded the inquiry</>}
            </div>
            {e.note && <div className="history-note">{e.note}</div>}
            <div className="muted small">{formatDateTime(e.createdAt)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
