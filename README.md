# Customer Inquiry Management System

A small web app where staff sign in, record customer inquiries, find them later, and move each one through **New → In progress → Resolved**, with a history of who changed what.

**Stack:** React 19 + Vite (frontend) · Node.js + Express 4 (API) · PostgreSQL 16 (via Docker) · Vitest for tests.
Design choices are explained in [DECISIONS.md](DECISIONS.md).

## Prerequisites
- Node.js 20.6 or newer
- Docker Desktop (runs Postgres; nothing else to install). To use your own Postgres instead, create the `cims` and `cims_test` databases and change the URLs in `backend/.env`.

## Run locally
```bash
docker compose up -d          # Postgres on localhost:5433 (also creates cims_test)

cd backend
cp .env.example .env
npm install
npm run db:migrate            # creates the tables
npm run db:seed               # test accounts + a few sample inquiries
npm run dev                   # API on http://localhost:4000

# in a second terminal
cd frontend
npm install
npm run dev                   # open http://localhost:5173 (it proxies /api to :4000)
```

## Test accounts
The password for all accounts is `Password123!`

| Email | Role | Can see |
|---|---|---|
| alice@example.com | staff | only inquiries she created |
| bob@example.com | staff | only inquiries he created |
| maya@example.com | manager | all inquiries |

**To try the access rule:** sign in as Bob and open `/inquiries/1`, which is Alice's. You get "Inquiry not found", and the API returns 404.
**To try the stale-data case:** open the same inquiry in two tabs, change the status in one, then try to change it in the other.

## Tests
```bash
cd backend && npm test        # needs the database running; uses cims_test, not cims
cd frontend && npm test
```

## API
| Method & path | Body | Result |
|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | 200 `{ user }` and sets an httpOnly cookie |
| `POST /api/auth/logout` | | 204 |
| `GET /api/auth/me` | | 200 `{ user }` or 401 |
| `GET /api/inquiries?status=&q=` | | 200 `{ inquiries }`, newest first; `q` searches name, contact and subject |
| `POST /api/inquiries` | `{ customerName, contact, subject, description }` | 201 `{ inquiry }` |
| `GET /api/inquiries/:id` | | 200 `{ inquiry }` including `events` (history) |
| `PATCH /api/inquiries/:id/status` | `{ status, version, note? }` | 200 `{ inquiry }` |

Errors always look like `{ "error": { "code", "message", "details"? } }`. The codes are listed in DECISIONS.md.

## Project layout
```
backend/
  migrations/          SQL migrations (run in order by src/db/migrate.js)
  src/domain/          status rules + zod schemas
  src/services/        all inquiry SQL, including the access rule
  src/routes/          HTTP layer (auth, inquiries)
  tests/               API tests (supertest + real test database)
frontend/src/
  api/                 fetch wrapper + one function per endpoint
  pages/               Login, list, new inquiry, detail
  components/, hooks/  Field, StatusBadge, useApi/useDebounced
  test/                component tests
```
