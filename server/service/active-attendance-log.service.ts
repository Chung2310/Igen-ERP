import { toVietnamDate } from "./company-work-calendar.service";

export interface AttendanceLogCandidate {
  date?: string;
  checkOut?: unknown;
  scheduledEndAt?: Date | string | null;
}

export function isAttendanceLogActiveOnDate(
  log: AttendanceLogCandidate | null | undefined,
  currentWorkDate: string,
): boolean {
  if (!log || log.checkOut) return false;
  if (log.date === currentWorkDate) return true;
  if (!log.scheduledEndAt) return false;

  const scheduledEndAt = new Date(log.scheduledEndAt);
  if (Number.isNaN(scheduledEndAt.getTime())) return false;
  return toVietnamDate(scheduledEndAt) === currentWorkDate;
}
