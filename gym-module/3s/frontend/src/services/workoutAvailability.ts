import type {
  WorkoutAvailabilitySlot,
  WorkoutScheduleWarning,
} from '../types/workoutAvailability';

interface ScheduledAvailabilityItem {
  weekNumber?: number;
  dayNumber: number;
  startMinute: number;
  durationMinutes: number;
}

const validMinute = (value: number, maximum: number) => (
  Number.isInteger(value) && value >= 0 && value <= maximum && value % 15 === 0
);

export function availabilityError(slots: WorkoutAvailabilitySlot[]): string | undefined {
  if (slots.length === 0) return 'Vui lòng thêm ít nhất một khung giờ rảnh.';

  const sorted = [...slots].sort((left, right) => (
    left.dayNumber - right.dayNumber || left.startMinute - right.startMinute
  ));
  for (let index = 0; index < sorted.length; index += 1) {
    const slot = sorted[index];
    if (!Number.isInteger(slot.dayNumber) || slot.dayNumber < 1 || slot.dayNumber > 7) {
      return 'Ngày rảnh không hợp lệ.';
    }
    if (!validMinute(slot.startMinute, 1425) || !validMinute(slot.endMinute, 1440)) {
      return 'Giờ rảnh phải theo bước 15 phút.';
    }
    if (slot.endMinute <= slot.startMinute) {
      return 'Giờ kết thúc phải sau giờ bắt đầu.';
    }

    const previous = sorted[index - 1];
    if (previous?.dayNumber === slot.dayNumber && slot.startMinute < previous.endMinute) {
      return 'Các khung giờ rảnh trong cùng ngày không được chồng nhau.';
    }
  }

  return undefined;
}

export function availabilitySummary(slots: WorkoutAvailabilitySlot[]): {
  dayCount: number;
  slotCount: number;
} {
  return {
    dayCount: new Set(slots.map((slot) => slot.dayNumber)).size,
    slotCount: slots.length,
  };
}

export function availabilityProposalDefaults(slots: WorkoutAvailabilitySlot[]): {
  sessionsPerWeek: number;
  minutesPerSession: number;
} {
  const longestSlotByDay = new Map<number, number>();

  for (const slot of slots) {
    const duration = slot.endMinute - slot.startMinute;
    if (duration <= 0) continue;
    longestSlotByDay.set(
      slot.dayNumber,
      Math.max(longestSlotByDay.get(slot.dayNumber) ?? 0, duration),
    );
  }

  return {
    sessionsPerWeek: longestSlotByDay.size,
    minutesPerSession: longestSlotByDay.size === 0
      ? 0
      : Math.min(240, ...longestSlotByDay.values()),
  };
}

export function outsideAvailabilityWarnings(
  items: ScheduledAvailabilityItem[],
  slots: WorkoutAvailabilitySlot[],
): WorkoutScheduleWarning[] {
  const sessions = new Map<string, ScheduledAvailabilityItem[]>();
  for (const item of items) {
    const key = `${item.weekNumber ?? 1}:${item.dayNumber}`;
    sessions.set(key, [...(sessions.get(key) || []), item]);
  }

  const warnings: WorkoutScheduleWarning[] = [];
  for (const sessionItems of sessions.values()) {
    const weekNumber = sessionItems[0].weekNumber ?? 1;
    const dayNumber = sessionItems[0].dayNumber;
    const startMinute = Math.min(...sessionItems.map((item) => item.startMinute));
    const endMinute = Math.max(...sessionItems.map((item) => (
      item.startMinute + item.durationMinutes
    )));
    const fits = slots.some((slot) => (
      slot.dayNumber === dayNumber
      && slot.startMinute <= startMinute
      && slot.endMinute >= endMinute
    ));

    if (!fits) {
      warnings.push({
        type: 'OUTSIDE_AVAILABILITY',
        weekNumber,
        dayNumber,
        startMinute,
        endMinute,
      });
    }
  }

  return warnings.sort((left, right) => (
    left.weekNumber - right.weekNumber
    || left.dayNumber - right.dayNumber
    || left.startMinute - right.startMinute
  ));
}

export function minuteLabel(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minuteFromTimeValue(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function weekdayLabel(dayNumber: number): string {
  return ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'][dayNumber - 1]
    || `Ngày ${dayNumber}`;
}
