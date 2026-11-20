CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inquiries (
  id            SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  contact       TEXT NOT NULL,
  subject       TEXT NOT NULL,
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  owner_id      INTEGER NOT NULL REFERENCES users(id),
  version       INTEGER NOT NULL DEFAULT 1,       -- optimistic concurrency (stale-tab detection)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- List view filters by owner + status and sorts by newest.
CREATE INDEX inquiries_owner_status_idx ON inquiries (owner_id, status, created_at DESC);

-- Status history: "what happened last" (the one extra feature).
CREATE TABLE inquiry_events (
  id          SERIAL PRIMARY KEY,
  inquiry_id  INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  actor_id    INTEGER NOT NULL REFERENCES users(id),
  from_status TEXT,                -- NULL for the "created" event
  to_status   TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inquiry_events_inquiry_idx ON inquiry_events (inquiry_id, created_at);
