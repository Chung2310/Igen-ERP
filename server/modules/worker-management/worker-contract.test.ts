import assert from "node:assert/strict";
import test from "node:test";
import { workerScopeFromActor } from "./contracts";

test("workerScopeFromActor normalizes company and branch scope", () => {
  assert.deepEqual(
    workerScopeFromActor({ companyCode: " acme ", branchId: " BR-01 " }),
    { companyCode: "ACME", branchId: "BR-01" },
  );
});

test("workerScopeFromActor omits a blank branch scope", () => {
  assert.deepEqual(workerScopeFromActor({ companyCode: "acme", branchId: " " }), {
    companyCode: "ACME",
  });
});

test("workerScopeFromActor requires a company scope", () => {
  assert.throws(() => workerScopeFromActor({ companyCode: " " }), {
    message: "Company scope is required",
  });
});
