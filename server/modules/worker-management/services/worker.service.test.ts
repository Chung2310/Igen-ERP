import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerQuery, normalizeWorkerInput } from "./worker.service";

test("buildWorkerQuery scopes workers by company and branch", () => {
  assert.deepEqual(buildWorkerQuery({ companyCode: "ACME", branchId: "B1" }), { companyCode: "ACME", branchId: "B1", deletedAt: null });
  assert.deepEqual(buildWorkerQuery({ companyCode: "ACME" }), { companyCode: "ACME", deletedAt: null });
});
test("normalizeWorkerInput trims required fields", () => {
  assert.deepEqual(normalizeWorkerInput({ fullName: " Nguyen Van A ", phone: " 090 ", status: "active" }), { fullName: "Nguyen Van A", phone: "090", status: "active" });
});
