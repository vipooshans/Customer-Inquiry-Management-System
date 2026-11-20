# Implementation Plan

This is a working plan, not the DECISIONS.md you submit. Change any decision you disagree with.
Then write DECISIONS.md in your own words from whatever you end up building.

## Stack

| Layer | Choice | Why |
|---|---|---|
| DB | PostgreSQL 16 in Docker (`docker compose up -d`) | Same setup on every machine, so the reviewer doesn't have to install Postgres |
| DB access | `pg` with hand-written SQL, plus plain `.sql` migration files and a small runner | Every query is visible and easy to explain. No ORM to defend in the interview |
| API | Express 4, `zod` for validation | zod gives field-level error messages that the UI can show next to each input |
| Auth | `bcryptjs` password hashes, JWT in an **httpOnly cookie** | JavaScript can't read the token. The Vite dev proxy keeps the frontend and API on the same origin, so there's no CORS setup |
| Frontend | React + Vite + React Router | Simple single-page app |
| Tests | Vitest everywhere. `supertest` for the API, React Testing Library for the UI | One test runner to learn |

## Data model

The full schema is in `backend/migrations/001_init.sql`.

- `users(id, email UNIQUE, name, password_hash, role ['staff'|'manager'])`
- `inquiries(id, customer_name, contact, subject, description, status, owner_id → users, version, created_at, updated_at)`
  - `status` is limited by a CHECK constraint to `new | in_progress | resolved`
  - `version` is an integer that goes up on every update. It's used to detect stale writes (see below)
- `inquiry_events(id, inquiry_id, actor_id, from_status, to_status, note, created_at)`. This is the **one extra feature**: a status history with an optional note. It answers "what happened last", which is one of the problems named in the brief.

## Decisions the brief leaves open (proposed)

### 1. Ownership and access
- **Rule:** `staff` see and change only the inquiries they own (`owner_id = me`). `manager` sees and changes everything.
- The owner is whoever created the inquiry. Reassigning inquiries is out of scope; list it under "what I'd improve next".
- Enforce the rule **in SQL**: `WHERE id = $1 AND (owner_id = $2 OR $3 = 'manager')`. A query like that can't accidentally return another person's row.
- When a staff member requests someone else's inquiry, return **404, not 403**. This hides whether the ID exists. Be ready to explain this choice in the interview.

### 2. Status transitions
```
new ──► in_progress ──► resolved
              ▲             │
              └── reopen ───┘
```
- Allowed: `new→in_progress`, `in_progress→resolved`, `resolved→in_progress` (reopen), and `new→resolved` (for example, spam or a question answered straight away).
- Rejected: `in_progress→new`, and setting the status it already has. The API returns `409 INVALID_TRANSITION` with a message.
- The UI only shows buttons for allowed transitions. The API still checks independently. Test it with curl or a test case.
- Keep the transition table in one module (`backend/src/domain/status.js`) and import it in the frontend too, or copy it, so there's a single source of truth.

### 3. Customer input
- **Required:** customer name (1–100), contact (an email or a phone number, checked with a simple regex), subject (3–150), description (1–2000). Trim whitespace first.
- The same zod-style rules run on the client, for instant feedback, and on the server, as the actual protection. The server returns `400 VALIDATION_ERROR` with `details: { field: message }`, and the form shows those messages next to the fields.
- **Duplicates:** if the same owner already has an *unresolved* inquiry with the same contact and subject (case-insensitive, trimmed), reject it with `409 DUPLICATE_INQUIRY` and include `existingId`. The UI then shows a link to the existing inquiry. The submit button is also disabled while a request is in progress, which prevents double clicks.

### 4. Stale data (two tabs)
- Every inquiry response includes `version`. The `PATCH /status` request sends `{ status, version }`.
- SQL: `UPDATE … SET status=$1, version=version+1 WHERE id=$2 AND version=$3 AND <access rule> RETURNING *`. If no row is updated, check whether the inquiry exists. If it does, the version didn't match, so return `409 STALE_VERSION` together with the current record.
- UI: show a banner that says the inquiry changed in another tab or by another user, and a button to reload it. Optionally, refetch when the window regains focus.
- **Trade-off:** there are no real-time updates. A stale tab only finds out when someone tries to save from it, or when the window regains focus. That's acceptable at this scale.

### 5. Errors (trustworthiness)
All errors use the same shape: `{ "error": { "code": "...", "message": "...", "details"?: {} } }`.

| Case | Status | code |
|---|---|---|
| No cookie, or an invalid or expired token | 401 | `UNAUTHENTICATED` |
| Non-numeric `:id` | 400 | `INVALID_ID` |
| Doesn't exist, or not yours | 404 | `NOT_FOUND` |
| Bad body | 400 | `VALIDATION_ERROR` |
| Duplicate | 409 | `DUPLICATE_INQUIRY` |
| Bad transition | 409 | `INVALID_TRANSITION` |
| Stale version | 409 | `STALE_VERSION` |
| Anything else | 500 | `INTERNAL` (log it, don't leak details) |

`HttpError` and the central error handler for this are already set up.

## API

```
POST   /api/auth/login            {email,password} → sets cookie, returns user
POST   /api/auth/logout           clears cookie
GET    /api/auth/me               current user, or 401

GET    /api/inquiries?status=&q=  list (access rule applied), newest first. q searches name, contact and subject (ILIKE)
POST   /api/inquiries             create → 201
GET    /api/inquiries/:id         detail + events
PATCH  /api/inquiries/:id/status  {status, version, note?} → updated inquiry
```

## Frontend screens and states

- `/login`: form with an error message and a pending state.
- `/inquiries`: a status filter (tabs or select) and a search box (debounced), a table with status badges, and **loading**, **empty** ("No inquiries yet" with a call to action, or "No matches"), and **error with retry** states.
- `/inquiries/new`: form with inline field errors, server errors mapped onto the fields, and the duplicate case with a link to the existing inquiry.
- `/inquiries/:id`: details, buttons for allowed transitions only, an optional note, the event history, the stale-version banner, and a **not-found** state that also covers invalid IDs and other people's inquiries.
- A `RequireAuth` wrapper calls `/api/auth/me`. On a 401 from any request, it redirects to `/login`.

Suggested structure: `api/client.js` (fetch wrapper, done) → `api/inquiries.js` (one function per endpoint) → a small `useAsync` or `useQuery`-style hook → pages. Keep state local to pages. With this few screens, you don't need a global store.

## Tests (minimum, plus a couple of extras)
- Backend: a staff member gets **404** for another user's inquiry. Also: an invalid transition returns 409, and a missing field returns 400.
- Frontend: submitting an empty form shows field errors and makes **no** API call. Also: the list shows the empty state.

## Suggested build order (about 10–12 hours)
1. `docker compose up -d`, then `npm run db:migrate` and `npm run db:seed` (done in the scaffold; check it works)
2. Auth: login, logout, me, and the `requireAuth` middleware. Write a test (401 with no cookie).
3. Inquiries: create, list, and get, with the access rule. Test the 404 case.
4. Status PATCH with transitions and version. Test the invalid transition and the stale version.
5. Frontend: login, then `RequireAuth`, then the list, then the form, then the detail page
6. Loading, empty, and error states. Frontend tests.
7. README, DECISIONS.md (including the AI usage note), screen recording
