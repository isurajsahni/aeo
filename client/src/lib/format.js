const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '—');

const UNITS = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 days ago", "just now". */
export function formatRelative(value) {
  if (!value) return '—';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
