type EnvLike = Record<string, string | undefined>;

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function bodyLimit(value: string | undefined, fallback: string): string {
  return value && /^\d+(?:kb|mb)$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

export function getDdosConfig(env: EnvLike = process.env) {
  return Object.freeze({
    globalWindowMs: positiveInt(env.DDOS_GLOBAL_WINDOW_MS, 15 * 60 * 1000),
    globalLimit: positiveInt(env.DDOS_GLOBAL_LIMIT, 1000),
    publicWindowMs: positiveInt(env.DDOS_PUBLIC_WINDOW_MS, 15 * 60 * 1000),
    publicLimit: positiveInt(env.DDOS_PUBLIC_LIMIT, 150),
    expensiveWindowMs: positiveInt(env.DDOS_EXPENSIVE_WINDOW_MS, 15 * 60 * 1000),
    expensiveLimit: positiveInt(env.DDOS_EXPENSIVE_LIMIT, 60),
    // Backstop per-IP lỏng cho endpoint xác thực: chỉ để chặn spray từ một IP, không khoá oan văn
    // phòng NAT (nhiều người đăng nhập tài khoản khác nhau qua cùng IP).
    authIpWindowMs: positiveInt(env.DDOS_AUTH_IP_WINDOW_MS, 15 * 60 * 1000),
    authIpLimit: positiveInt(env.DDOS_AUTH_IP_LIMIT, 300),
    // Throttle brute-force chặt theo từng tài khoản đích của /login.
    loginAccountWindowMs: positiveInt(env.DDOS_LOGIN_ACCOUNT_WINDOW_MS, 15 * 60 * 1000),
    loginAccountLimit: positiveInt(env.DDOS_LOGIN_ACCOUNT_LIMIT, 10),
    refreshIpWindowMs: positiveInt(env.DDOS_REFRESH_IP_WINDOW_MS, 15 * 60 * 1000),
    refreshIpLimit: positiveInt(env.DDOS_REFRESH_IP_LIMIT, 1000),
    generalBodyLimit: bodyLimit(env.DDOS_GENERAL_BODY_LIMIT, "2mb"),
    largeBodyLimit: bodyLimit(env.DDOS_LARGE_BODY_LIMIT, "300mb"),
    socketHandshakeWindowMs: positiveInt(env.DDOS_SOCKET_HANDSHAKE_WINDOW_MS, 60 * 1000),
    socketHandshakeLimit: positiveInt(env.DDOS_SOCKET_HANDSHAKE_LIMIT, 300),
    socketMaxPerUser: positiveInt(env.DDOS_SOCKET_MAX_PER_USER, 5),
    socketMaxPerIp: positiveInt(env.DDOS_SOCKET_MAX_PER_IP, 500),
    socketEventWindowMs: positiveInt(env.DDOS_SOCKET_EVENT_WINDOW_MS, 60 * 1000),
    socketEventLimit: positiveInt(env.DDOS_SOCKET_EVENT_LIMIT, 120),
    socketViolationLimit: positiveInt(env.DDOS_SOCKET_VIOLATION_LIMIT, 3),
    redisKeyPrefix: env.DDOS_REDIS_PREFIX?.trim() || "igen:ddos:",
  });
}

export const ddosConfig = getDdosConfig();
