import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { ddosConfig } from "../config/ddos";
import { getRateLimitRedisClient, RedisRateLimitStore } from "../infrastructure/rate-limit-redis";

const redisClient = getRateLimitRedisClient();
let lastStoreErrorAt = 0;

function logStoreError(...args: unknown[]): void {
  const now = Date.now();
  if (now - lastStoreErrorAt < 60_000) return;
  lastStoreErrorAt = now;
  console.error("[DDoS] Redis limiter warning; fail-open policy remains active:", ...args);
}

const throttledRateLimitLogger = {
  error: logStoreError,
  warn: logStoreError,
};

function redisLimiter(options: {
  prefix: string;
  windowMs: number;
  limit: number;
  message: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true,
    logger: throttledRateLimitLogger,
    keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown"),
    store: new RedisRateLimitStore(redisClient, `${ddosConfig.redisKeyPrefix}${options.prefix}:`),
    handler: (_req, res, _next, rateOptions) => {
      res.status(rateOptions.statusCode).json({ status: "error", message: options.message });
    },
  });
}

export const globalApiRateLimiter = redisLimiter({
  prefix: "http:global",
  windowMs: ddosConfig.globalWindowMs,
  limit: ddosConfig.globalLimit,
  message: "Quá nhiều yêu cầu tới hệ thống. Vui lòng thử lại sau.",
});

export const publicApiRateLimiter = redisLimiter({
  prefix: "http:public",
  windowMs: ddosConfig.publicWindowMs,
  limit: ddosConfig.publicLimit,
  message: "Quá nhiều yêu cầu tới endpoint công khai. Vui lòng thử lại sau.",
});

export const expensiveApiRateLimiter = redisLimiter({
  prefix: "http:expensive",
  windowMs: ddosConfig.expensiveWindowMs,
  limit: ddosConfig.expensiveLimit,
  message: "Quá nhiều tác vụ tốn tài nguyên. Vui lòng chờ trước khi thử lại.",
});

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
