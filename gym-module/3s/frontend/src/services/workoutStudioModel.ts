export interface StudioScheduleItem {
  id: string;
  weekNumber?: number;
  dayNumber: number;
  startMinute: number;
  durationMinutes: number;
}

export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT = 20;
export const DAY_MINUTES = 1440;
export const DAYS_PER_WEEK = 7;

export function planWeekCount(durationDays: number): number {
  return Math.max(1, Math.ceil(durationDays / DAYS_PER_WEEK));
}

export function planDaysForWeek(durationDays: number, weekNumber: number): number[] {
  const remainingDays = durationDays - (Math.max(1, weekNumber) - 1) * DAYS_PER_WEEK;
  return Array.from({ length: Math.max(0, Math.min(DAYS_PER_WEEK, remainingDays)) }, (_, index) => index + 1);
}

export function planDayIndex(item: Pick<StudioScheduleItem, 'weekNumber' | 'dayNumber'>): number {
  return ((item.weekNumber || 1) - 1) * DAYS_PER_WEEK + item.dayNumber;
}

export function snapMinute(value: number): number {
  return Math.max(0, Math.min(1425, Math.round(value / SLOT_MINUTES) * SLOT_MINUTES));
}

export function cardGeometry(startMinute: number, durationMinutes: number) {
  return { top: (startMinute / SLOT_MINUTES) * SLOT_HEIGHT, height: (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT };
}

export function hasOverlap<T extends StudioScheduleItem>(items: T[], candidate: T): boolean {
  return items.some((item) => item.id !== candidate.id && (item.weekNumber || 1) === (candidate.weekNumber || 1) && item.dayNumber === candidate.dayNumber && candidate.startMinute < item.startMinute + item.durationMinutes && item.startMinute < candidate.startMinute + candidate.durationMinutes);
}

export function formatMinute(minute: number): string {
  const bounded = Math.max(0, Math.min(DAY_MINUTES, minute));
  return `${String(Math.floor(bounded / 60)).padStart(2, '0')}:${String(bounded % 60).padStart(2, '0')}`;
}
