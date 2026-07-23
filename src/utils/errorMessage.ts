/**
 * Lấy thông báo lỗi thân thiện để hiển thị cho người dùng.
 * Ưu tiên message thật từ server (VD "Email đã tồn tại trong hệ thống"),
 * chỉ rơi về fallback khi lỗi là lỗi kỹ thuật/mạng không có ý nghĩa với người dùng.
 */
const TECHNICAL_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /unexpected token/i,
  /is not valid json/i,
  /aborterror/i,
  /the operation was aborted/i,
  /timeout/i,
];

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (err as { message?: string } | null)?.message;
  const trimmed = (message || "").trim();
  if (trimmed && !TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return trimmed;
  }
  return fallback;
}
