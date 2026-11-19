import type { CustomerJourneyDto, DailyProgressGroup } from '../types/progress';

function validDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() + 1 !== Number(month)
    || parsed.getUTCDate() !== Number(day)
  ) return null;
  if (value === `${year}-${month}-${day}`) return value;

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  const localMonth = String(timestamp.getMonth() + 1).padStart(2, '0');
  const localDay = String(timestamp.getDate()).padStart(2, '0');
  return `${timestamp.getFullYear()}-${localMonth}-${localDay}`;
}

export function buildDailyProgressGroups(
  journey: Pick<CustomerJourneyDto, 'sessions' | 'measurements' | 'photos'>,
): DailyProgressGroup[] {
  const groups = new Map<string, DailyProgressGroup>();

  for (const session of journey.sessions) {
    const dateKey = validDateKey(session.performedAt);
    if (!dateKey) continue;
    const group = groups.get(dateKey) || { dateKey, sessions: [], measurements: [], photos: [] };
    group.sessions.push(session);
    groups.set(dateKey, group);
  }

  for (const measurement of journey.measurements) {
    const dateKey = validDateKey(measurement.measuredAt);
    if (dateKey && groups.has(dateKey)) groups.get(dateKey)!.measurements.push(measurement);
  }

  for (const photo of journey.photos) {
    const dateKey = validDateKey(photo.takenDate);
    if (dateKey && groups.has(dateKey)) groups.get(dateKey)!.photos.push(photo);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions].sort(
        (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
      ),
    }))
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}
