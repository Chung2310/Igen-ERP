export const DAY_MINUTES = 1440;
export const SLOT_MINUTES = 15;

export type TimedExercise = {
  key: string;
  weekNumber?: number;
  dayNumber?: number;
  startMinute?: number;
  durationMinutes: number;
};

export function hasScheduleOverlap(items: TimedExercise[], candidate: TimedExercise): boolean {
  if (candidate.dayNumber === undefined || candidate.startMinute === undefined) return false;
  return items.some(item => item.key !== candidate.key && item.dayNumber === candidate.dayNumber
    && (item.weekNumber || 1) === (candidate.weekNumber || 1)
    && candidate.startMinute! < (item.startMinute || 0) + item.durationMinutes
    && (item.startMinute || 0) < candidate.startMinute! + candidate.durationMinutes);
}

export function nextAvailableMinute(items: TimedExercise[], weekNumber: number, dayNumber: number, durationMinutes = 60): number | null {
  const sameDay = items.filter(item => item.weekNumber === weekNumber && item.dayNumber === dayNumber);
  const maxEnd = sameDay.length ? Math.max(...sameDay.map(item => (item.startMinute || 0) + item.durationMinutes)) : 0;
  if (maxEnd + durationMinutes <= DAY_MINUTES) return maxEnd;
  for (let minute = 0; minute + durationMinutes <= DAY_MINUTES; minute += SLOT_MINUTES) {
    if (!hasScheduleOverlap(sameDay, { key: "candidate", weekNumber, dayNumber, startMinute: minute, durationMinutes })) return minute;
  }
  return null;
}

export function validSchedule(items: TimedExercise[]): boolean {
  return items.every(item => item.dayNumber !== undefined && item.startMinute !== undefined
    && item.startMinute >= 0 && item.durationMinutes > 0 && item.startMinute + item.durationMinutes <= DAY_MINUTES
    && !hasScheduleOverlap(items, item));
}
