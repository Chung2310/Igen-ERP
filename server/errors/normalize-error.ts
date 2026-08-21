import {
  AppError,
  ConflictError,
  InternalError,
  PayloadTooLargeError,
  UnauthorizedError,
  ValidationError,
} from "./app-error";

type UnknownRecord = Record<string, unknown>;

function asRecord(error: unknown): UnknownRecord | undefined {
  return typeof error === "object" && error !== null
    ? error as UnknownRecord
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function joiFields(error: UnknownRecord): string[] {
  if (!Array.isArray(error.details)) return [];
  return [...new Set(error.details.flatMap((detail) => {
    const record = asRecord(detail);
    return record ? stringArray(record.path).slice(0, 1) : [];
  }))];
}

function mongooseValidationFields(error: UnknownRecord): string[] {
  const errors = asRecord(error.errors);
  return errors ? Object.keys(errors) : [];
}

function duplicateFields(error: UnknownRecord): string[] {
  const keyPattern = asRecord(error.keyPattern);
  return keyPattern ? Object.keys(keyPattern) : [];
}

function isSafeHttpStatus(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 400 && (value as number) <= 599;
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const candidate = asRecord(error);
  if (!candidate) return new InternalError({ cause: error });

  if (candidate.isJoi === true || candidate.name === "ValidationError" && Array.isArray(candidate.details)) {
    const details = Array.isArray(candidate.details) ? candidate.details : [];
    const detailMessages = details
      .map((detail) => typeof detail === "object" && detail !== null ? (detail as { message?: string }).message : "")
      .filter(Boolean)
      .join(". ");
    return new ValidationError(
      "VALIDATION_FAILED",
      detailMessages || "Dữ liệu không hợp lệ.",
      { fields: joiFields(candidate) },
      error,
    );
  }

  if (candidate.name === "ValidationError" && asRecord(candidate.errors)) {
    return new ValidationError(
      "MODEL_VALIDATION_FAILED",
      "Dữ liệu không hợp lệ.",
      { fields: mongooseValidationFields(candidate) },
      error,
    );
  }

  if (candidate.name === "CastError") {
    return new ValidationError(
      "INVALID_IDENTIFIER",
      "Định dạng mã định danh không hợp lệ.",
      typeof candidate.path === "string" ? { field: candidate.path } : undefined,
      error,
    );
  }

  if (candidate.code === 11000 || candidate.code === "11000") {
    return new ConflictError(
      "DATABASE_CONFLICT",
      "Dữ liệu đã tồn tại.",
      { fields: duplicateFields(candidate) },
      error,
    );
  }

  if (candidate.name === "TokenExpiredError") {
    return new UnauthorizedError("AUTH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.", undefined, error);
  }

  if (candidate.name === "JsonWebTokenError" || candidate.name === "NotBeforeError") {
    return new UnauthorizedError("AUTH_TOKEN_INVALID", "Phiên đăng nhập không hợp lệ.", undefined, error);
  }

  if (candidate.name === "MulterError" && candidate.code === "LIMIT_FILE_SIZE") {
    return new PayloadTooLargeError("PAYLOAD_TOO_LARGE", "Tệp tải lên vượt quá dung lượng cho phép.", undefined, error);
  }

  if (candidate.type === "entity.parse.failed" && candidate.status === 400) {
    return new ValidationError("MALFORMED_JSON", "Dữ liệu JSON không hợp lệ.", undefined, error);
  }

  if (candidate.type === "entity.too.large" && candidate.status === 413) {
    return new PayloadTooLargeError("PAYLOAD_TOO_LARGE", "Dung lượng dữ liệu vượt quá giới hạn cho phép.", undefined, error);
  }
  const legacyStatus = isSafeHttpStatus(candidate.statusCode)
    ? candidate.statusCode
    : isSafeHttpStatus(candidate.status) ? candidate.status : undefined;
  if (legacyStatus !== undefined) {
    const message = typeof candidate.message === "string" && candidate.message.trim()
      ? candidate.message
      : legacyStatus >= 500 ? "Đã xảy ra lỗi hệ thống." : "Yêu cầu không thể xử lý.";
    return new AppError({
      code: "LEGACY_HTTP_ERROR",
      status: legacyStatus,
      message,
      expose: legacyStatus < 500,
      cause: error,
    });
  }

  return new InternalError({ cause: error });
}
