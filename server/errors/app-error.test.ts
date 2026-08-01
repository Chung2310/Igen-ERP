import assert from "node:assert/strict";
import test from "node:test";
import {
  AppError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "./app-error";

test("typed errors expose stable immutable metadata", () => {
  const details = { field: "phone" };
  const error = new ConflictError(
    "PARTNER_PHONE_ALREADY_EXISTS",
    "Số điện thoại đã tồn tại.",
    details,
  );

  details.field = "changed";

  assert.equal(error.name, "ConflictError");
  assert.equal(error.status, 409);
  assert.equal(error.code, "PARTNER_PHONE_ALREADY_EXISTS");
  assert.equal(error.expose, true);
  assert.deepEqual(error.details, { field: "phone" });
  assert.equal(Object.isFrozen(error.details), true);
  assert.equal(error instanceof AppError, true);
});

test("each public subtype fixes its HTTP status", () => {
  assert.equal(new ValidationError("VALIDATION_FAILED", "Sai dữ liệu").status, 400);
  assert.equal(new UnauthorizedError("AUTH_TOKEN_INVALID", "Chưa xác thực").status, 401);
  assert.equal(new ForbiddenError("FORBIDDEN", "Không có quyền").status, 403);
  assert.equal(new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy").status, 404);
  assert.equal(new PayloadTooLargeError("PAYLOAD_TOO_LARGE", "Dữ liệu quá lớn").status, 413);
  assert.equal(new RateLimitError("RATE_LIMIT_EXCEEDED", "Thao tác quá nhanh").status, 429);
  assert.equal(new ExternalServiceError("EXTERNAL_SERVICE_UNAVAILABLE", "Dịch vụ tạm gián đoạn").status, 502);
});

test("internal errors preserve cause but never expose it", () => {
  const cause = new Error("database password leaked");
  const error = new InternalError({ cause });

  assert.equal(error.status, 500);
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.equal(error.expose, false);
  assert.equal(error.cause, cause);
  assert.equal(error.message, "Đã xảy ra lỗi hệ thống.");
});