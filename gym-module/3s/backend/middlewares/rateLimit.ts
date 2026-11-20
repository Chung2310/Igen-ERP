import { rateLimit as expressRateLimit, type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return expressRateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', code: 'RATE_LIMITED', requestId: 'rate-limit' },
  } satisfies Partial<Options>);
}
