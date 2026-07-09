import rateLimit from "express-rate-limit";

/**
 * Giới hạn tần suất cho các endpoint xác thực nhạy cảm (login, register, change-password)
 * nhằm chặn brute-force mật khẩu. Giới hạn theo IP — đặt đủ rộng để văn phòng
 * nhiều người dùng chung một IP (NAT) không bị chặn nhầm.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.",
  },
});

/**
 * Giới hạn rộng hơn cho refresh-token: mỗi phiên hoạt động gọi định kỳ (~15 phút/lần),
 * nên một văn phòng đông người vẫn phải nằm trong hạn mức.
 */
export const refreshTokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Quá nhiều yêu cầu làm mới phiên đăng nhập. Vui lòng thử lại sau.",
  },
});
