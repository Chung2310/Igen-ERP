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
    err instanceof Error ? err.message : typeof err === "string" ? err : (err as { message?: string } | null)?.message;
  const trimmed = (message || "").trim();
  const friendly = trimmed && !TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed)) ? trimmed : fallback;
  return withRequestId(friendly, err);
}

export function withRequestId(message: string, err: unknown): string {
  const requestId = (err as { requestId?: unknown } | null)?.requestId;
  return typeof requestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
    ? `${message} (Mã tra cứu: ${requestId})`
    : message;
}
