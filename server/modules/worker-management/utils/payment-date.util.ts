/**
 * Chuẩn hóa ngày thanh toán.
 *
 * `Payment.date` trong lịch sử được ghi bằng `toDisplayDate()` phía frontend nên
 * lưu dạng chuỗi `DD/MM/YYYY`, trong khi dữ liệu import/cũ có thể là `YYYY-MM-DD`.
 * Chuỗi `DD/MM/YYYY` không so sánh được theo thứ tự (`"02/01/2026" < "15/12/2025"`),
 * nên mọi truy vấn lọc khoảng ngày trên trường này đều sai một cách lặng lẽ.
 *
 * Vì vậy `Payment` có thêm trường `paidOn: Date` — nguồn duy nhất để gom nhóm và
 * lọc theo thời gian trong báo cáo. `date` chỉ còn dùng để hiển thị.
 */

/** Định dạng ngày hợp lệ khi tạo/sửa giao dịch: DD/MM/YYYY hoặc YYYY-MM-DD */
export const PAYMENT_DATE_PATTERN = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/;

function buildUtcDate(year: number, month: number, day: number): Date | null {
  // Dùng UTC để ngày không bị lệch theo múi giờ của tiến trình server.
  const date = new Date(Date.UTC(year, month - 1, day));

  // Chặn ngày tràn (31/02 -> 03/03) mà Date tự âm thầm quy đổi.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Quy đổi chuỗi ngày thanh toán thành `Date`. Trả về `null` nếu không nhận dạng
 * được — nơi gọi tự quyết định bỏ qua hay báo lỗi, tuyệt đối không đoán bừa
 * thành ngày hôm nay vì như vậy giao dịch sẽ rơi sai kỳ báo cáo.
 */
export function parsePaymentDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) {
    return buildUtcDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
  }

  const dash = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dash) {
    return buildUtcDate(Number(dash[1]), Number(dash[2]), Number(dash[3]));
  }

  // Chuỗi ISO đầy đủ (dữ liệu import cũ) — lấy phần ngày, bỏ phần giờ.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (iso) {
    return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  return null;
}
