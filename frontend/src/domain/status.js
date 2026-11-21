// Copy of backend/src/domain/status.js, used only to decide which buttons to show.
// The API enforces the rules independently; if the two ever disagree, the server
// answers 409 INVALID_TRANSITION and the page shows that message.
export const STATUSES = ['new', 'in_progress', 'resolved'];

export const TRANSITIONS = {
  new: ['in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: ['in_progress'],
};

export const STATUS_LABELS = { new: 'New', in_progress: 'In progress', resolved: 'Resolved' };

// Button text for each target status, depending on where it starts.
export function actionLabel(from, to) {
  if (to === 'in_progress') return from === 'resolved' ? 'Reopen' : 'Start working';
  if (to === 'resolved') return 'Mark resolved';
  return STATUS_LABELS[to];
}

export const allowedNext = (status) => TRANSITIONS[status] ?? [];
