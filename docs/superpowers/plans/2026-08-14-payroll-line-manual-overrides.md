# Payroll Line Manual Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the six fixed period-input columns and let payroll managers override every remaining payroll component except derived totals on draft payroll rows.

**Architecture:** Store manual line overrides separately from payroll revisions and calculation snapshots. A pure resolver merges system calculation values with explicit overrides, preserves hidden system income, and derives deduction total and net pay on the backend. `PayrollTab` uses the same resolver semantics for an immediate preview and saves dirty rows through a versioned, audited bulk API.

**Tech Stack:** TypeScript 5.8, Mongoose 9, Express 4, React 19, Testing Library 16, Vitest 4

## Global Constraints

- Hide exactly `agreedSalary`, `reconciledDays`, `reconciledHours`, `allowance`, period-input `bonus`, and period-input `deduction` from the payroll table.
- Editable result fields are `baseSalary`, `adjustedBase`, `overtime`, `bonusTotal`, `penaltyTotal`, `socialInsurance`, `healthInsurance`, `unemploymentInsurance`, `personalIncomeTax`, `otherDeductions`, `advances`, and active `custom.<code>` values.
- `deductionTotal` and `net` are always derived and never accepted from the client.
- Only `payroll:manage` users may write, and only a regular payroll run with status `draft` may be edited.
- Explicit `0` is an override; restoration uses `clearFields`.
- Every write requires a non-empty reason, optimistic version, tenant/branch scope, audit metadata, and per-row bulk results.
- Manual overrides do not mutate calculation revisions and survive explicit payroll recalculation until restored.
- Hidden system income components remain included in derived net pay.

---

## File Structure

- Create `server/interface/payroll-line-override.interface.ts`: shared field and persistence types.
- Create `server/model/payroll-line-override.model.ts`: tenant/branch/period/employee override persistence.
- Create `server/service/payroll-line-override-resolver.service.ts`: pure merge and derived-total logic.
- Create `server/service/payroll-line-override-resolver.service.test.ts`: resolver contract and edge cases.
- Create `server/service/payroll-line-override-operations.service.ts`: scoped list/save/bulk operations, locking, versioning, and audit.
- Create `server/service/payroll-line-override-operations.service.test.ts`: persistence behavior and partial results.
- Create `server/controller/payroll-line-override.controller.ts`: HTTP adapters.
- Modify `server/router/payroll.router.ts`: read and manage routes.
- Modify `server/router/payroll-run-operations.router.test.ts`: route/permission coverage.
- Modify `server/service/payroll-run-calculate-operations.service.ts`: retain overrides across recalculation and expose effective lines.
- Modify `server/service/payroll-run-calculate-operations.test.ts`: recalculation preservation.
- Modify `server/controller/payroll.controller.ts`: overlay effective values in period and run reads.
- Modify `server/controller/payroll.controller.period-branch-scope.test.ts`: tenant/branch and response coverage.
- Modify `src/services/payrollService.ts`: line-override list and bulk-save calls.
- Create `src/components/hr/payroll/payrollLineOverrides.ts`: UI field definitions, draft payloads, preview resolver, and partial-failure retention.
- Create `src/components/hr/payroll/payrollLineOverrides.test.ts`: pure UI behavior.
- Modify `src/components/hr/PayrollTab.tsx`: remove fixed inputs and render editable result components.
- Modify `src/components/hr/PayrollTab.test.tsx`: render, save, read-only, and derived-preview acceptance coverage.

### Task 1: Override Types, Model, and Pure Resolver

**Files:**
- Create: `server/interface/payroll-line-override.interface.ts`
- Create: `server/model/payroll-line-override.model.ts`
- Create: `server/service/payroll-line-override-resolver.service.ts`
- Test: `server/service/payroll-line-override-resolver.service.test.ts`

**Interfaces:**
- Consumes: a normalized payroll row with system component values.
- Produces: `PAYROLL_LINE_OVERRIDE_FIELDS`, `PayrollLineOverrideValues`, and `resolvePayrollLineOverride(system, override)` returning `{ values, deductionTotal, net, provenance }`.

- [ ] **Step 1: Write failing resolver tests**

Cover explicit zero, absent fields, hidden income preservation, derived values, and ignored client-derived fields:

```ts
it("replaces components but preserves hidden system income", () => {
  const result = resolvePayrollLineOverride({
    baseSalary: 20_000_000, adjustedBase: 18_000_000, overtime: 1_000_000,
    bonusTotal: 500_000, hiddenIncome: 700_000, penaltyTotal: 100_000,
    socialInsurance: 400_000, healthInsurance: 100_000,
    unemploymentInsurance: 50_000, personalIncomeTax: 200_000,
    otherDeductions: 25_000, advances: 300_000,
  }, { bonusTotal: 0, socialInsurance: 250_000 });
  expect(result.values.bonusTotal).toBe(0);
  expect(result.deductionTotal).toBe(1_025_000);
  expect(result.net).toBe(18_675_000);
});
```

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `npx vitest run server/service/payroll-line-override-resolver.service.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add exact types and field allowlist**

```ts
export const PAYROLL_LINE_OVERRIDE_FIELDS = [
  "baseSalary", "adjustedBase", "overtime", "bonusTotal", "penaltyTotal",
  "socialInsurance", "healthInsurance", "unemploymentInsurance",
  "personalIncomeTax", "otherDeductions", "advances",
] as const;
export type PayrollLineOverrideField = typeof PAYROLL_LINE_OVERRIDE_FIELDS[number];
export type PayrollLineOverrideValues = Partial<Record<PayrollLineOverrideField, number>> & {
  customValues?: Record<string, number>;
};
```

- [ ] **Step 4: Implement the minimal pure resolver**

Merge only allowlisted fields, preserve `hiddenIncome`, compute deductions as the sum of the seven deduction components, and compute `net = Math.max(0, round(adjustedBase + overtime + bonusTotal + hiddenIncome - deductionTotal))`. Return `manual_override` or `system` provenance per field.

- [ ] **Step 5: Add the Mongoose model**

Use `{ companyCode, branchId, periodKey, employeeId }` as a unique compound index. Store optional numeric component fields, `customValues`, required trimmed `reason`, `version` defaulting to `0`, and `updatedBy`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run server/service/payroll-line-override-resolver.service.test.ts && npm run typecheck`

Expected: resolver tests PASS and typecheck exits `0`.

- [ ] **Step 7: Commit**

```powershell
git add server/interface/payroll-line-override.interface.ts server/model/payroll-line-override.model.ts server/service/payroll-line-override-resolver.service.ts server/service/payroll-line-override-resolver.service.test.ts
git commit -m "feat(payroll): add manual line override domain"
```

### Task 2: Scoped, Audited Bulk Override API

**Files:**
- Create: `server/service/payroll-line-override-operations.service.ts`
- Test: `server/service/payroll-line-override-operations.service.test.ts`
- Create: `server/controller/payroll-line-override.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Modify: `server/router/payroll-run-operations.router.test.ts`

**Interfaces:**
- Consumes: `{ employeeId, expectedVersion, reason, values, customValues, clearFields }` rows.
- Produces: `listPayrollLineOverrides(scope, periodKey)` and `bulkSavePayrollLineOverrides(scope, periodKey, actorId, rows)`.

- [ ] **Step 1: Write failing operation tests**

Assert that save rejects a missing/non-draft run, empty reason, negative/non-finite values, unknown fields, invalid custom codes, and version conflicts. Assert `$unset` distinguishes restore from zero, audit metadata contains before/after and reason, and bulk results retain success for valid rows when another row fails.

- [ ] **Step 2: Run the operation tests and verify RED**

Run: `npx vitest run server/service/payroll-line-override-operations.service.test.ts`

Expected: FAIL because the operations module does not exist.

- [ ] **Step 3: Implement draft locking and validation**

Query `PayrollRunModel.findOne({ ...scope, periodKey, type: "regular" })`; reject missing runs and statuses other than `draft` with `PAYROLL_LINE_OVERRIDE_LOCKED` and HTTP `409`. Validate only the Task 1 allowlist and `custom.<code>` clear paths. Reject `deductionTotal` and `net` with `PAYROLL_LINE_OVERRIDE_FIELD_INVALID`.

- [ ] **Step 4: Implement optimistic upsert and audit**

Filter on `{ ...scope, periodKey, employeeId, version: expectedVersion }`, `$set` submitted values, `$unset` restored paths, and `$inc: { version: 1 }`. Write `PayrollAuditModel` metadata with `operation: "line_override"`, `employeeId`, `reason`, `values`, `clearFields`, `before`, and `after`.

- [ ] **Step 5: Add controller and routes**

Add:

```ts
payrollRouter.get("/periods/:periodKey/line-overrides", requirePermission("payroll:read"), controller.list);
payrollRouter.put("/periods/:periodKey/line-overrides", requirePermission("payroll:manage"), controller.bulk);
```

The controller obtains scope from the authenticated request using the same company/branch helper as period inputs and returns stable row results.

- [ ] **Step 6: Add route permission assertions**

Assert the GET route uses `payroll:read`, PUT uses `payroll:manage`, and neither route is unguarded.

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run server/service/payroll-line-override-operations.service.test.ts server/router/payroll-run-operations.router.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```powershell
git add server/service/payroll-line-override-operations.service.ts server/service/payroll-line-override-operations.service.test.ts server/controller/payroll-line-override.controller.ts server/router/payroll.router.ts server/router/payroll-run-operations.router.test.ts
git commit -m "feat(payroll): add manual line override API"
```

### Task 3: Apply Overrides to Payroll Reads and Recalculation

**Files:**
- Modify: `server/service/payroll-run-calculate-operations.service.ts`
- Test: `server/service/payroll-run-calculate-operations.test.ts`
- Modify: `server/controller/payroll.controller.ts`
- Test: `server/controller/payroll.controller.period-branch-scope.test.ts`

**Interfaces:**
- Consumes: persisted line overrides and Task 1 resolver.
- Produces: effective line values with `systemValues`, `overrideValues`, `overrideVersion`, `deductionTotal`, and `net` while retaining immutable revisions.

- [ ] **Step 1: Write failing read-overlay tests**

Arrange a draft run line containing allowances/other positive income not rendered as editable columns and an override changing `adjustedBase`, `bonusTotal`, and insurance. Assert the response preserves hidden income, derives net on the backend, and includes system/effective values plus version.

- [ ] **Step 2: Write failing recalculation-preservation test**

Arrange an existing override, execute payroll recalculation, and assert the completed revision retains system calculation values while the returned effective line still applies the override.

- [ ] **Step 3: Run both tests and verify RED**

Run: `npx vitest run server/service/payroll-run-calculate-operations.test.ts server/controller/payroll.controller.period-branch-scope.test.ts`

Expected: FAIL because line overrides are not loaded or resolved.

- [ ] **Step 4: Add normalized system-value adapter**

Map `calculation` and `vietnam` to the Task 1 resolver fields. Compute `hiddenIncome` from the stored gross/income total minus the visible editable income components, clamped at `0`, so allowances and other system additions are preserved.

- [ ] **Step 5: Overlay reads without mutating snapshots**

Load overrides with the same tenant, branch, period, and employee scope. Return effective values as response projections only. Do not update revision lines or their checksum when a manual override is saved or read.

- [ ] **Step 6: Keep overrides across recalculation**

Do not delete or overwrite `PayrollLineOverride` records in calculate/recalculate. After calculation completes, resolve the new system result against the existing override for the response and subsequent reads.

- [ ] **Step 7: Run focused regression tests**

Run: `npx vitest run server/service/payroll-run-calculate-operations.test.ts server/controller/payroll.controller.period-branch-scope.test.ts server/service/payroll-checksum.service.test.ts`

Expected: all tests PASS and checksum tests prove revisions remain based on system calculations.

- [ ] **Step 8: Commit**

```powershell
git add server/service/payroll-run-calculate-operations.service.ts server/service/payroll-run-calculate-operations.test.ts server/controller/payroll.controller.ts server/controller/payroll.controller.period-branch-scope.test.ts
git commit -m "feat(payroll): apply manual overrides to effective lines"
```

### Task 4: Editable Payroll Result Cells and Derived Preview

**Files:**
- Modify: `src/services/payrollService.ts`
- Create: `src/components/hr/payroll/payrollLineOverrides.ts`
- Test: `src/components/hr/payroll/payrollLineOverrides.test.ts`
- Modify: `src/components/hr/PayrollTab.tsx`
- Test: `src/components/hr/PayrollTab.test.tsx`

**Interfaces:**
- Consumes: line override list/bulk API and effective payroll rows from Task 3.
- Produces: draft helpers, editable result cells, restore actions, reason-gated bulk save, and live derived previews.

- [ ] **Step 1: Write failing pure helper tests**

Test explicit zero, custom values, clear fields, employee-keyed drafts, expected versions, failed-row retention, and preview calculation preserving hidden income. Reuse immutable patterns from `payrollInlineInputs.ts` but define result-specific field types instead of widening the old period-input helper.

- [ ] **Step 2: Run helper tests and verify RED**

Run: `npx vitest run src/components/hr/payroll/payrollLineOverrides.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement helper and service methods**

Add:

```ts
getLineOverrides: (periodKey: string) => request(`/periods/${periodKey}/line-overrides`),
bulkSaveLineOverrides: (periodKey: string, rows: unknown[]) =>
  request(`/periods/${periodKey}/line-overrides`, { method: "PUT", body: JSON.stringify({ rows }) }),
```

Implement typed field definitions, immutable draft helpers, payload construction, failed-row retention, and the same derived preview formula as Task 1.

- [ ] **Step 4: Write failing table acceptance tests**

Assert the six fixed period-input labels are absent. In a manageable draft run, assert inputs exist for every editable result field and active custom variable, while `deductionTotal` and `net` are plain text. Edit bonus and insurance, assert both derived cells update, restore one persisted override, save two employees with one reason, and retain only a conflicting row on partial failure.

- [ ] **Step 5: Add read-only tests**

Arrange `review`, `closed`, and no-manage states. Assert component values remain visible but no editable inputs, restore controls, or save action exist.

- [ ] **Step 6: Run PayrollTab tests and verify RED**

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx`

Expected: FAIL because fixed columns still render and result columns are not editable.

- [ ] **Step 7: Replace period-input table cells**

Remove `INPUT_FIELDS` rendering and the old `getPeriodInputs`/`bulkSavePeriodInputs` inline flow from `PayrollTab`. Keep the custom-variable catalog panel unchanged. Render result component inputs only when `canManage && run?.status === "draft"`; otherwise render formatted values.

- [ ] **Step 8: Add preview, restore, and bulk save UI**

Use employee/field-keyed drafts. Show amber unsaved and cyan persisted states, preserve drafts across sorting/filtering, calculate `deductionTotal` and `net` preview without inputs, require a trimmed reason, submit one bulk request, reload successful rows, and retain failed drafts/errors.

- [ ] **Step 9: Run UI and helper tests**

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx src/components/hr/payroll/payrollLineOverrides.test.ts`

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/services/payrollService.ts src/components/hr/payroll/payrollLineOverrides.ts src/components/hr/payroll/payrollLineOverrides.test.ts src/components/hr/PayrollTab.tsx src/components/hr/PayrollTab.test.tsx
git commit -m "feat(payroll): edit payroll result components inline"
```

### Task 5: Full Verification and Scope Review

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: merge-readiness evidence.

- [ ] **Step 1: Run all focused feature and payroll regression tests**

```powershell
npx vitest run server/service/payroll-line-override-resolver.service.test.ts server/service/payroll-line-override-operations.service.test.ts server/service/payroll-run-calculate-operations.test.ts server/controller/payroll.controller.period-branch-scope.test.ts server/router/payroll-run-operations.router.test.ts src/components/hr/payroll/payrollLineOverrides.test.ts src/components/hr/PayrollTab.test.tsx server/service/payroll-period-input-operations.service.test.ts server/service/payroll-period-input-resolver.service.test.ts server/service/payroll-effective-input.service.test.ts
```

Expected: all selected files and tests PASS with zero failures.

- [ ] **Step 2: Run TypeScript checking**

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite and server esbuild both exit `0`.

- [ ] **Step 4: Inspect whitespace and scope**

```powershell
git diff --check
git status --short
git diff --name-only origin/develop...HEAD
```

Expected: no uncommitted files or whitespace errors; changes remain limited to the design/plan, line-override domain/API/integration, payroll service, `PayrollTab`, and their tests.

