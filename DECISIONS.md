# Decisions

## Assumptions
- A small team (tens of staff, thousands of inquiries). One Node process, one Postgres database.
- Staff accounts are seeded; there is no registration or password reset.
- The person who records an inquiry is the one responsible for it.

## Design choices

**1. Access rule: staff see their own inquiries; managers see everything.**
"Who is handling this?" is the main problem in the brief, so ownership is explicit: `owner_id` is set to whoever creates the inquiry. The rule is written into the `WHERE` clause of every query (`owner_id = $me OR $role = 'manager'`), so a query cannot return a row the user may not see, whatever the UI does. If a staff member opens someone else's inquiry by direct link, the API answers **404, not 403**: a 403 would confirm that the ID exists. Missing, deleted, and not-yours all look the same to the client.

**2. Status rules live in one module and the API enforces them.**
Allowed: `new → in_progress`, `new → resolved` (spam, or answered on the spot), `in_progress → resolved`, and `resolved → in_progress` (**reopen**: customers do come back). Not allowed: going back to `new`, which means "nobody has touched it yet", and "changing" to the current status. An invalid change returns `409 INVALID_TRANSITION` with a readable message. The UI only shows buttons for allowed moves, but `backend/src/domain/status.js` is the real rule. The frontend copy only decides which buttons to show. Every change writes a row to `inquiry_events` with an optional note. This status history is the one extra feature. It answers "what happened last" without anyone digging through chat logs.

**3. Validation runs on both sides, and the server's result is the one that counts.**
zod schemas on the server return `400 VALIDATION_ERROR` with `{ field: message }`, and the form shows each message under its field. The client runs the same checks first for instant feedback and to avoid a round trip. Contact must look like an email or a phone number; the check is intentionally loose. **Duplicates:** the same owner can't have two *open* inquiries with the same contact and subject (trimmed, case-insensitive). The API returns `409 DUPLICATE_INQUIRY` with the existing ID, and the form links to it. A per-owner advisory lock makes two simultaneous submits safe. The submit button is also disabled while saving. Resolved inquiries don't count, so a returning customer can still be recorded.

## Stale data (two tabs) and the trade-off I accepted
Each inquiry has a `version` that goes up on every change. A status change sends the version the user last saw. If it no longer matches, the API refuses with `409 STALE_VERSION` and returns the current record. The page then shows the newer status, explains that their change was **not** saved, and keeps their note so they can decide whether to try again. The detail page also refetches when the tab becomes visible again, so most stale views fix themselves before anyone clicks.
**Trade-off:** there are no live updates (no WebSockets or polling). A tab left open in the foreground can show an old status until the user acts or switches tabs. Nothing is ever silently overwritten, though. For a small team I chose correctness over immediacy and kept the moving parts down.

## Errors
Every error has the same shape, `{ error: { code, message, details? } }`: 401 `UNAUTHENTICATED` (no or invalid cookie), 400 `INVALID_ID` (e.g. `/inquiries/abc`), 404 `NOT_FOUND`, 400 `VALIDATION_ERROR`, 409 for business-rule conflicts, and 500 `INTERNAL` with nothing leaked. The session is a JWT in an **httpOnly, SameSite=Lax cookie**, so page JavaScript can't read it. The user is reloaded from the database on each request. If any request gets a 401, the app returns to the sign-in page with a "session expired" note and remembers the page the user was on.

## Testing and gaps
- Backend (`supertest` against a real `cims_test` database): access rule (404 for another staff member's inquiry, by read *and* by update), 401 on every route, validation messages, duplicates, every transition rule, stale version, bad IDs, and the search escaping `%`.
- Frontend (React Testing Library, `fetch` mocked): form errors with no API call, server errors mapped onto fields, the duplicate link, double-submit protection, list loading, empty, no-match and error-with-retry states, only allowed buttons shown, and the stale-version banner.
- **Gaps:** no browser end-to-end tests in CI (I checked the flow manually); no tests for session expiry mid-use; the list is capped at 200 rows with no pagination.

## What I'd improve next
1. Reassigning an inquiry to another staff member (a manager action, also recorded in the history).
2. Pagination or infinite scroll for the list, and status counts on the filter tabs.
3. Login rate limiting, and a CSRF token if the app is ever served cross-site.
4. Playwright end-to-end tests for the three situations in the brief.

## Use of AI
I used Claude (Anthropic) heavily on this project, and I want to be clear about how much:
- **What AI did:** it drafted the implementation plan, then wrote most of the code: the inquiry API and SQL, the three inquiry pages, the backend and frontend tests, the README and a first draft of this file. It also ran the app in a browser to check the main flow and the failure cases.
- **What I did:** I set the requirements from the brief, reviewed the code and decisions, and checked that the tests pass. I'm responsible for every line, and I've gone through each part so I can explain it.
- **A suggestion I kept:** returning **404 instead of 403** for another staff member's inquiry, so the API never confirms that an ID exists.
- **Suggestions that changed:** the plan's first idea for the two-tabs case was a banner with a "reload" button. The final version shows the server's latest record straight away and keeps the user's note, because a reload would have thrown away what they typed. The plan also suggested importing the backend's status rules into the frontend. I kept a small copy in the frontend instead, used only to decide which buttons to show, so the server stays the single authority.
- **How I checked it:** 34 API tests against a real Postgres database, 16 component tests, and a manual browser run of the three situations in the brief.
