// Inquiry lifecycle rules. This file is the single source of truth on the server;
// frontend/src/domain/status.js is a copy used only to decide which buttons to show.
//
//   new ──► in_progress ──► resolved
//    │                        ▲   │
//    └────────────────────────┘   └──► in_progress   (reopen)
//
// Not allowed: going back to "new" (it means "nobody has looked at it yet",
// which stops being true once someone has), and "changing" to the same status.
export const STATUSES = ['new', 'in_progress', 'resolved'];

export const TRANSITIONS = {
  new: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: ['in_progress'],
};

export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);
