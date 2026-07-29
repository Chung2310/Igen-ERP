import type { ErrorCode } from "./error-codes";

export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface AppErrorOptions {
  code: ErrorCode;
  status: number;
  message: string;
  details?: Record<string, unknown>;
  expose?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;
  readonly expose: boolean;
  override readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details
      ? Object.freeze({ ...options.details })
      : undefined;
    this.expose = options.expose ?? options.status < 500;
    Object.defineProperty(this, "cause", {
      value: options.cause,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type PublicErrorOptions = {
  details?: Record<string, unknown>;
  cause?: unknown;
};

abstract class FixedStatusError extends AppError {
  constructor(status: number, code: ErrorCode, message: string, options: PublicErrorOptions = {}) {
    super({ status, code, message, expose: true, ...options });
  }
}

export class ValidationError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(400, code, message, { details, cause });
  }
}

export class UnauthorizedError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(401, code, message, { details, cause });
  }
}

export class ForbiddenError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(403, code, message, { details, cause });
  }
}

export class NotFoundError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(404, code, message, { details, cause });
  }
}

export class ConflictError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(409, code, message, { details, cause });
  }
}

export class PayloadTooLargeError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(413, code, message, { details, cause });
  }
}

export class RateLimitError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(429, code, message, { details, cause });
  }
}

export class ExternalServiceError extends FixedStatusError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, cause?: unknown) {
    super(502, code, message, { details, cause });
  }
}

export class InternalError extends AppError {
  constructor(options: { message?: string; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super({
      code: "INTERNAL_ERROR",
      status: 500,
      message: options.message ?? "Đã xảy ra lỗi hệ thống.",
      details: options.details,
      expose: false,
      cause: options.cause,
    });
  }
}