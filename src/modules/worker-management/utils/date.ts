/**
 * Chuẩn hóa ngày hiển thị trong phân hệ lao động về DD/MM/YYYY.
 * Dữ liệu cũ có thể đang ở dạng YYYY-MM-DD, DD/MM/YYYY hoặc ISO đầy đủ.
 */
export function formatWorkerDate(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[1].padStart(2, "0")}/${displayMatch[2].padStart(2, "0")}/${displayMatch[3]}`;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`;
  }

  return raw;
}

/** Giá trị ngày mặc định cho các trường nhập ngày. */
export function todayWorkerDate(): string {
  return formatWorkerDate(new Date());
}
