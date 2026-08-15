import assert from "node:assert/strict";
import test from "node:test";
import { ApiClientError, parseApiErrorResponse } from "./apiClientError";

test("parses the standard API error envelope", async () => {
  const response = new Response(JSON.stringify({ ok: false, error: { code: "PARTNER_PHONE_ALREADY_EXISTS", message: "Số điện thoại đã tồn tại.", details: { field: "phone" }, requestId: "req-1" } }), { status: 409, headers: { "content-type": "application/json" } });
  const error = await parseApiErrorResponse(response);
  assert.equal(error instanceof ApiClientError, true);
  assert.equal(error.status, 409);
  assert.equal(error.code, "PARTNER_PHONE_ALREADY_EXISTS");
  assert.equal(error.message, "Số điện thoại đã tồn tại.");
  assert.deepEqual(error.details, { field: "phone" });
  assert.equal(error.requestId, "req-1");
});

test("parses worker-management success=false error objects", async () => {
  const response = new Response(JSON.stringify({ success: false, error: { code: "POLICY_NOT_ACTIVE", message: "Chính sách hoa hồng chưa hoạt động." } }), { status: 409, headers: { "content-type": "application/json" } });
  const error = await parseApiErrorResponse(response);
  assert.equal(error.code, "POLICY_NOT_ACTIVE");
  assert.equal(error.message, "Chính sách hoa hồng chưa hoạt động.");
});

test("uses a safe fallback for malformed and non-JSON responses", async () => {
  const malformed = new Response("gateway down", { status: 502, headers: { "content-type": "text/plain" } });
  const malformedError = await parseApiErrorResponse(malformed);
  assert.equal(malformedError.code, "UNKNOWN_API_ERROR");
  assert.equal(malformedError.message, "Yêu cầu không thể xử lý.");
  assert.equal(malformedError.status, malformed.status);

  const legacy = new Response(JSON.stringify({ message: "legacy secret" }), { status: 500, headers: { "content-type": "application/json" } });
  const legacyError = await parseApiErrorResponse(legacy);
  assert.equal(legacyError.code, "API_ERROR");
  assert.equal(legacyError.message, "legacy secret");
  assert.equal(legacyError.status, legacy.status);
});
