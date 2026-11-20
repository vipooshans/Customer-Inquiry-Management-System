# Customer Inquiry Management System

React (Vite) frontend · Express API · PostgreSQL.

## Prerequisites
- Node.js 20.6+ (developed on 24)
- Docker Desktop (runs Postgres; nothing else to install)

## Setup
```bash
docker compose up -d                 # Postgres on localhost:5433 (also creates cims_test)

cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev                          # API on http://localhost:4000

cd ../frontend                       # in a second terminal
npm install
npm run dev                          # app on http://localhost:5173 (proxies /api to :4000)
```

## Test accounts
Password for all accounts: `Password123!`

| Email | Role | Sees |
|---|---|---|
| alice@example.com | staff | own inquiries |
| bob@example.com | staff | own inquiries |
| maya@example.com | manager | all inquiries |

## Tests
```bash
cd backend && npm test     # needs the Docker DB running; uses the cims_test database
cd frontend && npm test
```

See DECISIONS.md for design choices.
