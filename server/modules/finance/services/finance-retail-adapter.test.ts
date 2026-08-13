import assert from "node:assert/strict";
import test from "node:test";
import { reconcileReceivableTotals } from "./receivable-reconciliation.service";
import { createFinanceRetailAdapter } from "./finance-retail-adapter";
import { financeCutoverEnabled } from "../config/finance-cutover";
import { readFileSync } from "node:fs";

test("reconciliation reports exact mismatches at company, branch, customer, and order levels", () => {
  const retail = [
    { companyCode: "ACME", branchId: "B1", customerId: "C1", sourceId: "O1", balance: 70 },
    { companyCode: "ACME", branchId: "B1", customerId: "C2", sourceId: "O2", balance: 30 },
  ];
  const finance = [
    { companyCode: "ACME", branchId: "B1", customerId: "C1", sourceId: "O1", balance: 60 },
    { companyCode: "ACME", branchId: "B1", customerId: "C2", sourceId: "O2", balance: 30 },
  ];
  const result = reconcileReceivableTotals(retail, finance);
  assert.equal(result.mismatches.some((item: any) => item.level === "company" && item.difference === -10), true);
  assert.equal(result.mismatches.some((item: any) => item.level === "branch" && item.difference === -10), true);
  assert.equal(result.mismatches.some((item: any) => item.level === "customer" && item.key.endsWith("|C1") && item.difference === -10), true);
  assert.equal(result.mismatches.some((item: any) => item.level === "order" && item.key.endsWith("|O1") && item.difference === -10), true);
  assert.equal(result.repaired, 0);
});

test("adapter selects Finance after cutover and legacy before cutover without dual calls", async () => {
  const calls: string[] = [];
  const dependencies = {
    finance: { history: async () => { calls.push("finance-read"); return "finance"; }, adjust: async () => { calls.push("finance-write"); return "finance-write"; } },
    legacy: { history: async () => { calls.push("legacy-read"); return "legacy"; }, adjust: async () => { calls.push("legacy-write"); return "legacy-write"; } },
  };
  const before = createFinanceRetailAdapter({ ...dependencies, cutover: () => false });
  assert.equal(await before.history({ companyCode: "ACME", branchId: "B1" }, "C1", {}), "legacy");
  assert.equal(await before.adjust({ companyCode: "ACME", branchId: "B1" }, {}, {}), "legacy-write");
  assert.deepEqual(calls, ["legacy-read", "legacy-write"]);
  calls.length = 0;
  const after = createFinanceRetailAdapter({ ...dependencies, cutover: () => true });
  assert.equal(await after.history({ companyCode: "ACME", branchId: "B1" }, "C1", {}), "finance");
  assert.equal(await after.adjust({ companyCode: "ACME", branchId: "B1" }, {}, {}), "finance-write");
  assert.deepEqual(calls, ["finance-read", "finance-write"]);
});

test("cutover is off unless explicitly enabled", () => {
  assert.equal(financeCutoverEnabled({}), false);
  assert.equal(financeCutoverEnabled({ FINANCE_RECEIVABLE_CUTOVER: "true" }), true);
  assert.equal(financeCutoverEnabled({ FINANCE_RECEIVABLE_CUTOVER: "false" }), false);
});

test("Retail receivable controller delegates compatibility reads and commands through one adapter", () => {
  const source = readFileSync(new URL("../../retail/controllers/retail-receivable.controller.ts", import.meta.url), "utf8");
  assert.match(source, /FinanceRetailCompatibilityAdapter/);
  assert.doesNotMatch(source, /RetailReceivableLedgerService\.adjust/);
  assert.doesNotMatch(source, /RetailReceivableLedgerService\.reverse/);
});
