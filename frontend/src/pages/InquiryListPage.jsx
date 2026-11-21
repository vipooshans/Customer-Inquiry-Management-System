import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listInquiries } from '../api/inquiries.js';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { STATUSES, STATUS_LABELS } from '../domain/status.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDateTime } from '../components/format.js';

const FILTERS = [{ value: '', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))];

// Filters live in the URL (?status=&q=) so Back, refresh and shared links keep them.
export default function InquiryListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';

  // The input updates instantly; the URL (and the request) follow after a pause.
  const [searchText, setSearchText] = useState(q);
  const debouncedSearch = useDebounced(searchText.trim(), 300);
  useEffect(() => {
    if (debouncedSearch !== q) updateParams({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function updateParams(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchText('');
    setParams({}, { replace: true });
  }

  const { data: inquiries, error, loading, reload } = useApi(
    (signal) => listInquiries({ status, q }, { signal }),
    [status, q],
  );
  const filtered = Boolean(status || q);

  return (
    <main className="page">
      <div className="page-header">
        <h1>Inquiries</h1>
        <Link to="/inquiries/new" className="btn">New inquiry</Link>
      </div>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={status === f.value}
              className={`tab${status === f.value ? ' tab-active' : ''}`}
              onClick={() => updateParams({ status: f.value })}>
              {f.label}
            </button>
          ))}
        </div>
        <input type="search" className="search" aria-label="Search inquiries"
          placeholder="Search name, contact or subject" maxLength={100}
          value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>

      <ListBody inquiries={inquiries} error={error} loading={loading} filtered={filtered}
        onRetry={reload} onClearFilters={clearFilters} />
    </main>
  );
}

function ListBody({ inquiries, error, loading, filtered, onRetry, onClearFilters }) {
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <p>Could not load inquiries. {error.message}</p>
        <button className="btn btn-secondary" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (inquiries === undefined) return <p className="muted" role="status">Loading inquiries…</p>;

  if (inquiries.length === 0) {
    return filtered ? (
      <div className="empty">
        <p>No inquiries match these filters.</p>
        <button className="btn btn-secondary" onClick={onClearFilters}>Clear filters</button>
      </div>
    ) : (
      <div className="empty">
        <p>No inquiries yet.</p>
        <p className="muted">Record the first customer inquiry to start tracking it.</p>
        <Link to="/inquiries/new" className="btn">New inquiry</Link>
      </div>
    );
  }

  return (
    // While a new filter loads, the old rows stay visible but dimmed (no flash).
    <div className={loading ? 'is-refreshing' : undefined} aria-busy={loading}>
      <table className="table">
        <thead>
          <tr>
            <th>Status</th><th>Subject</th><th>Customer</th><th>Owner</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((i) => (
            <tr key={i.id} className="row-link" onClick={() => navigate(`/inquiries/${i.id}`)}>
              <td><StatusBadge status={i.status} /></td>
              <td><Link to={`/inquiries/${i.id}`} onClick={(e) => e.stopPropagation()}>{i.subject}</Link></td>
              <td>{i.customerName}<div className="muted small">{i.contact}</div></td>
              <td>{i.owner.name}</td>
              <td className="nowrap">{formatDateTime(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{inquiries.length} {inquiries.length === 1 ? 'inquiry' : 'inquiries'}</p>
    </div>
  );
}
