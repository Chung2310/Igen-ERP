import { countRemainingSessions, countTotalSessions } from "./session-count.util";

/** Ngưỡng cảnh báo vàng: lớp đã hoàn thành từ 80% số buổi theo lịch. */
export const YELLOW_PROGRESS_THRESHOLD = 0.8;

export type BatchProgressLevel = "green" | "yellow" | "red" | "black" | "grey";
export type BatchAgeLabel = "yellow" | "red" | null;

export interface BatchProgress {
  totalSessions: number;
  doneSessions: number;
  remainingSessions: number;
  progressLevel: BatchProgressLevel;
  /** Nhãn phụ độc lập với progressLevel, chỉ có ở lớp đã hoàn thành */
  ageLabel: BatchAgeLabel;
}

interface ProgressInput {
  status: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  completedAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

interface ProgressOptions {
  /** YYYY-MM-DD theo giờ Việt Nam */
  today: string;
  holidaySet?: Set<string>;
}

const CLOSED_STATUSES = ["Đã kết thúc", "Đã hủy"];

function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

/**
 * Nhãn tuổi lớp chỉ áp dụng cho lớp đã hoàn thành ("Đã kết thúc"), không
 * áp cho lớp bị hủy. Lớp cũ chưa có completedAt thì lấy tạm updatedAt.
 */
function computeAgeLabel(input: ProgressInput, today: string): BatchAgeLabel {
  if (input.status !== "Đã kết thúc") return null;
  const anchor = input.completedAt || input.updatedAt;
  if (!anchor) return null;

  const completedDate = new Date(anchor);
  if (Number.isNaN(completedDate.getTime())) return null;

  const todayDate = new Date(`${today}T00:00:00Z`);
  if (todayDate > addCalendarMonths(completedDate, 12)) return "red";
  if (todayDate >= addCalendarMonths(completedDate, 6)) return "yellow";
  return null;
}

/**
 * Cảnh báo tiến độ vận hành của lớp theo quy tắc đã chốt:
 * quá hạn mà chưa đóng lớp ⇒ đỏ (ưu tiên cao nhất); hoàn thành từ 80% ⇒ vàng.
 */
export function computeBatchProgress(input: ProgressInput, options: ProgressOptions): BatchProgress {
  const { today, holidaySet } = options;
  const { status, startDate, endDate, daysOfWeek } = input;

  const totalSessions = countTotalSessions(startDate, endDate, daysOfWeek, holidaySet);
  const remainingSessions = countRemainingSessions(today, endDate, startDate, daysOfWeek, holidaySet);
  const doneSessions = Math.max(0, totalSessions - remainingSessions);
  const ageLabel = computeAgeLabel(input, today);

  if (CLOSED_STATUSES.includes(status)) {
    if (status === "Đã kết thúc" && ageLabel === "yellow") {
      return { totalSessions, doneSessions, remainingSessions: 0, progressLevel: "black", ageLabel: null };
    }
    return { totalSessions, doneSessions, remainingSessions: 0, progressLevel: "grey", ageLabel };
  }

  // Lớp chưa khai giảng không có cảnh báo vận hành. Nếu đã qua ngày kết thúc
  // mà vẫn chưa đóng, quy tắc quá hạn bên dưới vẫn ưu tiên để tránh bỏ sót.
  if (status === "Sắp khai giảng" && today <= endDate) {
    return { totalSessions, doneSessions, remainingSessions, progressLevel: "grey", ageLabel };
  }

  // Quá ngày kết thúc nhưng lớp chưa được đóng — ưu tiên hơn cảnh báo vàng.
  if (today > endDate) {
    return { totalSessions, doneSessions, remainingSessions: 0, progressLevel: "red", ageLabel };
  }

  if (status === "Đang học" && totalSessions > 0 && doneSessions / totalSessions >= YELLOW_PROGRESS_THRESHOLD) {
    return { totalSessions, doneSessions, remainingSessions, progressLevel: "yellow", ageLabel };
  }

  return { totalSessions, doneSessions, remainingSessions, progressLevel: "green", ageLabel };
}
