import type { WorkerContractAlertLevel, WorkerLaborContractStatus } from "../types";

/** Số ngày trước hạn bắt đầu cảnh báo hợp đồng. */
export const WORKER_CONTRACT_ALERT_DAYS = 30;

/** Nhận cả YYYY-MM-DD (dữ liệu server) lẫn DD/MM/YYYY (người dùng nhập). */
export function parseFlexibleDate(value?: string) {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const display = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (display) {
    return new Date(Number(display[3]), Number(display[2]) - 1, Number(display[1]));
  }
  return null;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** YYYY-MM-DD → DD/MM/YYYY để hiển thị. */
export function toDisplayDate(value?: string) {
  const date = parseFlexibleDate(value);
  if (!date) return value || "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** DD/MM/YYYY → YYYY-MM-DD để gửi lên server. */
export function toIsoDate(value?: string) {
  const date = parseFlexibleDate(value);
  if (!date) return value || "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Số ngày còn lại tới hạn. Chuẩn hóa về mốc UTC nửa đêm nên không lệch khi
 * qua mốc đổi giờ.
 */
export function daysUntil(value?: string, today = new Date()): number | null {
  const date = parseFlexibleDate(value);
  if (!date) return null;
  const end = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - now) / 86_400_000);
}

export function resolveAlertLevel(
  endDate?: string,
  status: WorkerLaborContractStatus = "active",
  today = new Date(),
  alertDays = WORKER_CONTRACT_ALERT_DAYS,
): WorkerContractAlertLevel {
  if (status === "renewed" || status === "terminated") return "ok";
  const remaining = daysUntil(endDate, today);
  if (remaining === null) return "ok";
  if (remaining < 0) return "expired";
  if (remaining <= alertDays) return "expiring";
  return "ok";
}

export function alertText(endDate?: string, today = new Date()) {
  const remaining = daysUntil(endDate, today);
  if (remaining === null) return "";
  if (remaining < 0) return `Quá hạn ${Math.abs(remaining)} ngày`;
  if (remaining === 0) return "Hết hạn hôm nay";
  return `Còn ${remaining} ngày`;
}
