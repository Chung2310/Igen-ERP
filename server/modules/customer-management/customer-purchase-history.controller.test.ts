import assert from "node:assert/strict";
import test from "node:test";
import { RetailScopeError } from "../retail/contracts";
import { purchaseHistoryScopeFromRequest, purchaseHistoryServiceInput } from "./customer.controller";

test("purchase history uses the authenticated branch and rejects a mismatched requested branch", () => {
  const request = (query: Record<string, unknown>) => ({
    user: { role: "user", companyCode: "IGEN", branchId: "branch-a" },
    query,
  }) as any;

  assert.deepEqual(purchaseHistoryScopeFromRequest(request({})), { companyCode: "IGEN", branchId: "branch-a" });
  assert.throws(
    () => purchaseHistoryScopeFromRequest(request({ branchId: "branch-b" })),
    (error) => error instanceof RetailScopeError && error.status === 403,
  );
});

test("purchase history passes only company scope to the customer service", () => {
  const input = purchaseHistoryServiceInput({
    user: { role: "user", companyCode: "IGEN", branchId: "branch-a" },
    query: {},
  } as any);

  assert.deepEqual(input, { customerScope: { companyCode: "IGEN" }, branchId: "branch-a" });
});
