export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86400000;
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export function businessDateKey(value: Date) { return dayFormatter.format(value); }

/** Reject normalized dates such as 30 February instead of silently moving them into March. */
export function parseBusinessDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return !Number.isNaN(date.getTime()) && businessDateKey(date) === value ? date : null;
}

export function businessCalendarRange(period: string, from = '', to = '', now = new Date()) {
  if (Number.isNaN(now.getTime())) return null;
  const today = businessDateKey(now);
  let start = parseBusinessDate(today)!;
  let end = now;
  if (period === 'custom') {
    const first = parseBusinessDate(from), last = parseBusinessDate(to);
    if (!first || !last || first > last) return null;
    start = first; end = new Date(last.getTime() + DAY_MS - 1);
  } else if (period === 'week') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = new Date(start.getTime() - ((weekday + 6) % 7) * DAY_MS);
  } else if (period === 'month') {
    start = parseBusinessDate(`${today.slice(0, 7)}-01`)!;
  } else if (period === 'quarter') {
    const month = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
    start = parseBusinessDate(`${today.slice(0, 4)}-${String(month).padStart(2, '0')}-01`)!;
  } else if (period === 'year') {
    start = parseBusinessDate(`${today.slice(0, 4)}-01-01`)!;
  } else if (period !== 'today' && period !== 'day') return null;
  return { start, end, filter: period };
}
