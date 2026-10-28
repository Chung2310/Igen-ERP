import type { OverviewPoint } from '../../../shared/business-overview';

/** Aggregate only days inside the selected range, with zero-filled gaps. */
export function buildOverviewSeries(points: OverviewPoint[], from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) return [];
  const monthly = days > 90;
  const yearly = days > 3650;
  const keyLength = yearly ? 4 : monthly ? 7 : 10;
  const values = new Map<string, number>();
  const current = new Date(start);
  if (monthly) current.setUTCDate(1);
  if (yearly) current.setUTCMonth(0);
  for (let index = 0; current <= end && index < 10000; index++) {
    values.set(current.toISOString().slice(0, keyLength), 0);
    if (yearly) current.setUTCFullYear(current.getUTCFullYear() + 1);
    else if (monthly) current.setUTCMonth(current.getUTCMonth() + 1);
    else current.setUTCDate(current.getUTCDate() + 1);
  }
  points.forEach(point => {
    if (point.date < from || point.date > to) return;
    const key = point.date.slice(0, keyLength);
    if (values.has(key)) values.set(key, values.get(key)! + point.value);
  });
  return [...values].map(([date, value]) => ({ date, value }));
}
