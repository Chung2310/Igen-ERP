import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "../../errors/error-codes";
import { normalizeError } from "../../errors/normalize-error";
import { createReceivableController } from "./controllers/receivable.controller";
import { financeReceivableRoutes, FINANCE_RECEIVABLE_ROUTE_PERMISSIONS } from "./routes/receivable.routes";
import { validateAdjustment, validateCollection, validateExtension, validateReason, validateSuspension } from "./validations/receivable.validation";

test("receivable routes expose documented endpoints with exact permission classes", () => {
  assert.deepEqual(FINANCE_RECEIVABLE_ROUTE_PERMISSIONS, {
    "GET /": "finance:read", "GET /aging": "finance:read", "GET /by-customer": "finance:read", "GET /:id": "finance:read",
    "POST /:id/payments": "finance:manage", "POST /:id/adjustments": "finance:manage", "POST /:id/write-off": "finance:manage",
    "POST /:id/suspend": "finance:manage", "POST /:id/extend": "finance:manage", "POST /:id/entries/:entryId/reversal": "finance:manage",
  });
  const routes = financeReceivableRoutes.stack.filter((layer: any) => layer.route).map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, Object.keys(FINANCE_RECEIVABLE_ROUTE_PERMISSIONS));
  assert.equal(financeReceivableRoutes.stack.filter((layer: any) => layer.route).every((layer: any) => layer.route.stack.length === 2), true);
});

test("controller derives branch scope, ignores body scope, and forwards errors", async () => {
  const calls: any[] = [];
  const dependencies: any = {};
  for (const name of ["list", "detail", "aging", "byCustomer", "collect", "adjust", "writeOff", "suspend", "extend", "reverse"]) dependencies[name] = async (...args: any[]) => { calls.push([name, ...args]); return { name }; };
  const controller: any = createReceivableController(dependencies);
  const response = { json(value: any) { return value; } } as any;
  const actor = { id: "u1", role: "user", companyCode: "ACME", branchId: "B1" };
  await controller.collect({ user: actor, query: {}, params: { id: "r1" }, body: { amount: 10, paymentMethod: "cash", idempotencyKey: "k1", companyCode: "EVIL", branchId: "B9" } }, response, assert.fail);
  assert.deepEqual(calls[0], ["collect", { companyCode: "ACME", branchId: "B1" }, "r1", { amount: 10, paymentMethod: "cash", idempotencyKey: "k1" }, actor]);
  const error = new Error("boom"); dependencies.detail = async () => { throw error; };
  const failing: any = createReceivableController(dependencies); let forwarded: any;
  await failing.detail({ user: actor, query: {}, params: { id: "r1" }, body: {} }, response, (value: any) => { forwarded = value; });
  assert.equal(forwarded, error);
});

test("validation enforces integer VND, balance cap, payment method, reasons, and ISO dates", () => {
  assert.deepEqual(validateCollection({ amount: 50, paymentMethod: "transfer", reference: " CK1 ", idempotencyKey: " k1 " }), { amount: 50, paymentMethod: "transfer", reference: "CK1", idempotencyKey: "k1" });
  for (const amount of [0, -1, 1.5]) assert.throws(() => validateCollection({ amount, paymentMethod: "cash", idempotencyKey: "k" }), /INVALID_VND_AMOUNT/);
  assert.throws(() => validateCollection({ amount: 101, paymentMethod: "cash", idempotencyKey: "k" }, 100), /PAYMENT_EXCEEDS_BALANCE/);
  assert.throws(() => validateCollection({ amount: 1, paymentMethod: "crypto", idempotencyKey: "k" }), /INVALID_PAYMENT_METHOD/);
  assert.throws(() => validateReason({ reason: "" }), /REASON_REQUIRED/);
  assert.deepEqual(validateAdjustment({ amount: 20, direction: "decrease", reason: " Sửa lệch ", idempotencyKey: " a1 " }), { amount: 20, direction: "decrease", reason: "Sửa lệch", idempotencyKey: "a1" });
  assert.deepEqual(validateSuspension({ until: "2026-08-20T00:00:00.000Z", reason: " Chờ đối soát " }), { until: new Date("2026-08-20T00:00:00.000Z"), reason: "Chờ đối soát" });
  assert.throws(() => validateSuspension({ until: "20-08-2026", reason: "x" }), /INVALID_DATE/);
  assert.deepEqual(validateExtension({ dueDate: "2026-08-30T23:59:59.999Z", reason: " Gia hạn ", idempotencyKey: " ex-1 " }), { dueDate: new Date("2026-08-30T23:59:59.999Z"), reason: "Gia hạn", idempotencyKey: "ex-1" });
  assert.throws(() => validateExtension({ dueDate: "30-08-2026", reason: "x", idempotencyKey: "k" }), /INVALID_DATE/);
  assert.throws(() => validateExtension({ dueDate: "2026-02-30T23:59:59.999Z", reason: "x", idempotencyKey: "k" }), /INVALID_DATE/);
});

test("documented receivable error codes are registered", () => {
  for (const code of ["RECEIVABLE_ALREADY_SETTLED", "PAYMENT_EXCEEDS_BALANCE", "ADJUSTMENT_REASON_REQUIRED", "ENTRY_ALREADY_REVERSED", "RECEIVABLE_NOT_FOUND"]) assert.equal((ERROR_CODES as any)[code], code);
});

test("receivable validation errors survive the global error normalizer", () => {
  try { validateCollection({ amount: 101, paymentMethod: "cash", idempotencyKey: "k" }, 100); assert.fail(); }
  catch (error) { const normalized = normalizeError(error); assert.equal(normalized.status, 400); assert.equal(normalized.code, "PAYMENT_EXCEEDS_BALANCE"); }
  try { validateAdjustment({ amount: 1, direction: "increase", reason: "", idempotencyKey: "k" }); assert.fail(); }
  catch (error) { assert.equal(normalizeError(error).code, "ADJUSTMENT_REASON_REQUIRED"); }
});
