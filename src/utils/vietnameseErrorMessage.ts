const FALLBACK = "Đã xảy ra lỗi. Vui lòng thử lại.";

const VIETNAMESE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const RULES = [
  {
    pattern: /failed to fetch|network(?: request)? (?:error|failed)|\bload failed/i,
    message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.",
  },
  {
    pattern: /unauthorized|invalid token|jwt|session.*(?:expired|invalid)/i,
    message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  },
  {
    pattern: /forbidden|permission denied|not allowed|access denied/i,
    message: "Bạn không có quyền thực hiện thao tác này.",
  },
  {
    pattern: /upload.*failed|failed.*upload/i,
    message: "Tải tệp lên thất bại. Vui lòng thử lại.",
  },
  {
    pattern: /download.*failed|failed.*download/i,
    message: "Tải tệp xuống thất bại. Vui lòng thử lại.",
  },
  {
    pattern: /timeout|timed out/i,
    message: "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.",
  },
  { pattern: /not found/i, message: "Không tìm thấy dữ liệu yêu cầu." },
  {
    pattern: /validation|invalid|required/i,
    message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
  },
  {
    pattern: /internal server error|server error/i,
    message: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  },
] as const;

export function toVietnameseErrorMessage(message: unknown): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return FALLBACK;
  if (VIETNAMESE.test(text)) return text;
  return RULES.find(({ pattern }) => pattern.test(text))?.message || FALLBACK;
}
