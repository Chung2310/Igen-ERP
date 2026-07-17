import rateLimit from "express-rate-limit";
import { ddosConfig } from "../config/ddos";
import { getRateLimitRedisClient, RedisRateLimitStore } from "../infrastructure/rate-limit-redis";
import { shouldBypassRateLimits } from "./load-test-bypass";
import { resolveClientRateKey, resolveLoginAccountKey } from "./rate-limit-key";

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
    skip: shouldBypassRateLimits,
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true,
    logger: throttledRateLimitLogger,
    keyGenerator: resolveClientRateKey,
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
 * Backstop theo IP cho các endpoint xác thực (login, register, change-password): chỉ để chặn spray
 * ồ ạt từ MỘT IP. Đặt rộng (mặc định 100/15ph, chỉnh qua DDOS_AUTH_IP_LIMIT) để văn phòng nhiều
 * người dùng chung một IP (NAT/CGNAT) — mỗi người một tài khoản khác nhau — không bị chặn nhầm.
 * Chống brute-force đúng từng tài khoản do loginAccountRateLimiter đảm nhiệm.
 */
export const authRateLimiter = rateLimit({
  skip: shouldBypassRateLimits,
  windowMs: ddosConfig.authIpWindowMs,
  limit: ddosConfig.authIpLimit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.",
  },
});

/**
 * Throttle brute-force chặt theo TỪNG TÀI KHOẢN đích (email trong body), không theo IP — nên một văn
 * phòng NAT đăng nhập các tài khoản khác nhau không ảnh hưởng lẫn nhau, còn dò mật khẩu một tài khoản
 * vẫn bị chặn. Không xác định được email thì bỏ qua (để authRateLimiter theo IP lo).
 */
export const loginAccountRateLimiter = rateLimit({
  skip: (req) => shouldBypassRateLimits(req) || resolveLoginAccountKey(req) === null,
  keyGenerator: (req) => resolveLoginAccountKey(req) as string,
  windowMs: ddosConfig.loginAccountWindowMs,
  limit: ddosConfig.loginAccountLimit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Tài khoản này đã thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.",
  },
});

/**
 * Giới hạn rộng hơn cho refresh-token: mỗi phiên hoạt động gọi định kỳ (~15 phút/lần),
 * nên một văn phòng đông người vẫn phải nằm trong hạn mức.
 */
export const refreshTokenRateLimiter = rateLimit({
  skip: shouldBypassRateLimits,
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Quá nhiều yêu cầu làm mới phiên đăng nhập. Vui lòng thử lại sau.",
  },
});
