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

test("uses a safe fallback for malformed and non-JSON responses", async () => {
  for (const response of [
    new Response("gateway down", { status: 502, headers: { "content-type": "text/plain" } }),
    new Response(JSON.stringify({ message: "legacy secret" }), { status: 500, headers: { "content-type": "application/json" } }),
  ]) {
    const error = await parseApiErrorResponse(response);
    assert.equal(error.code, "UNKNOWN_API_ERROR");
    assert.equal(error.message, "Yêu cầu không thể xử lý.");
    assert.equal(error.status, response.status);
  }
});