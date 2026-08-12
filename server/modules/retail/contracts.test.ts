import assert from "node:assert/strict";
import test from "node:test";
import {
  requireRetailBranch,
  RetailScopeError,
  retailScopeFromRequest,
} from "./contracts";

test("normal users derive retail scope from their actor identity", () => {
  assert.deepEqual(
    retailScopeFromRequest(
      { role: "user", companyCode: " acme ", branchId: " b1 " },
      {},
    ),
    { companyCode: "ACME", branchId: "b1" },
  );
});

test("normal users cannot request another company or branch", () => {
  assert.throws(
    () => retailScopeFromRequest(
      { role: "user", companyCode: "ACME", branchId: "B1" },
      { companyCode: "OTHER" },
    ),
    (error) => error instanceof RetailScopeError && error.status === 403,
  );
  assert.throws(
    () => retailScopeFromRequest(
      { role: "user", companyCode: "ACME", branchId: "B1" },
      { branchId: "B2" },
    ),
    (error) => error instanceof RetailScopeError && error.status === 403,
  );
});

test("superadmin must provide explicit company and branch scope", () => {
  assert.throws(
    () => retailScopeFromRequest({ role: "superadmin" }, { branchId: "B1" }),
    (error) => error instanceof RetailScopeError && error.status === 400,
  );
  assert.throws(
    () => requireRetailBranch(retailScopeFromRequest(
      { role: "superadmin" },
      { companyCode: "ACME" },
    )),
    (error) => error instanceof RetailScopeError && error.status === 400,
  );
  assert.deepEqual(
    requireRetailBranch(retailScopeFromRequest(
      { role: "superadmin" },
      { companyCode: " acme ", branchId: "B1" },
    )),
    { companyCode: "ACME", branchId: "B1" },
  );
});
