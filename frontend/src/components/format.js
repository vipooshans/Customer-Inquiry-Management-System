const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso) => dateTime.format(new Date(iso));
