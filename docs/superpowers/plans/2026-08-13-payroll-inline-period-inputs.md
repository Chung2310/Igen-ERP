# Payroll Inline Period Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the six payroll period-input fields directly editable per employee in the main payroll table during `draft`, with one batch-save action and read-only visibility after the draft stage.

**Architecture:** Preserve the existing `PayrollTab` inline-draft and bulk period-input API flow. Add integration coverage around the real rendered table, separate visibility from editability so managers can still inspect period inputs after `draft`, and keep pure draft/payload transformations in `payrollInlineInputs.ts`.

**Tech Stack:** TypeScript 5.8, React 19, Testing Library 16, Vitest 4, Express 4, Mongoose 9

## Global Constraints

- The fixed fields are exactly `agreedSalary`, `reconciledDays`, `reconciledHours`, `allowance`, `bonus`, and `deduction`.
- Only payroll managers may edit.
- Editing is allowed only when no run exists or the run status is `draft` and the period-input API reports `editable: true`.
- A single `Lưu thay đổi` action saves all dirty employees and requires one non-empty reconciliation reason.
- Entering `0` is a valid override; restoring a persisted override uses `clearFields` and returns to source data.
- Partial failures retain only failed employee drafts and display their errors.
- Saving period inputs must not automatically recalculate payroll.
- Existing payroll lifecycle, policy, formula, revision, and snapshot behavior must remain unchanged.

---

## File Structure

- Modify `src/components/hr/PayrollTab.test.tsx`: render-level acceptance tests for the six columns, draft editing, batch save, reason validation, partial failure, and read-only states.
- Modify `src/components/hr/PayrollTab.tsx`: separate `showPeriodInputColumns` from `inlineEditable`; retain existing inline draft and save flow while showing disabled values after `draft`.
- Modify `src/components/hr/payroll/payrollInlineInputs.test.ts`: complete pure helper coverage for multiple employees, mixed core/custom values, restoration, and failed-row retention.
- Modify `src/components/hr/payroll/payrollInlineInputs.ts` only if the new helper tests expose a payload or draft-retention defect.

### Task 1: Complete Pure Draft and Payload Coverage

**Files:**
- Modify: `src/components/hr/payroll/payrollInlineInputs.test.ts`
- Modify if required by a failing test: `src/components/hr/payroll/payrollInlineInputs.ts`

**Interfaces:**
- Consumes: `setDraftValue`, `restoreDraftField`, `removeDraftField`, `buildDirtyRows`, and `retainFailedDrafts`.
- Produces: stable batch payload semantics used by the rendered-table tests in Task 2.

- [ ] **Step 1: Add tests for a multi-employee batch and mixed restoration**

Add the following cases:

```ts
it("builds one batch row per dirty employee with core and custom values", () => {
  let drafts = setDraftValue({}, "e1", "agreedSalary", 15_000_000);
  drafts = setDraftValue(drafts, "e1", "bonus", 0);
  drafts = setDraftValue(drafts, "e2", "reconciledDays", 22.5);
  drafts = setDraftValue(drafts, "e2", "custom.sales", 12);

  expect(buildDirtyRows(drafts, [
    { employeeId: "e1", version: 3 },
    { employeeId: "e2", version: 7 },
  ], "  Đối soát tháng 8  ")).toEqual([
    {
      employeeId: "e1",
      expectedVersion: 3,
      reason: "Đối soát tháng 8",
      agreedSalary: 15_000_000,
      bonus: 0,
      clearFields: [],
    },
    {
      employeeId: "e2",
      expectedVersion: 7,
      reason: "Đối soát tháng 8",
      reconciledDays: 22.5,
      customValues: { sales: 12 },
      clearFields: [],
    },
  ]);
});

it("sends restored core and custom fields through clearFields", () => {
  let drafts = restoreDraftField({}, "e1", "allowance");
  drafts = restoreDraftField(drafts, "e1", "custom.sales");
  expect(buildDirtyRows(drafts, [{ employeeId: "e1", version: 2 }], "Khôi phục nguồn")).toEqual([
    {
      employeeId: "e1",
      expectedVersion: 2,
      reason: "Khôi phục nguồn",
      clearFields: ["allowance", "custom.sales"],
    },
  ]);
});
```

- [ ] **Step 2: Run the helper tests**

Run: `npx vitest run src/components/hr/payroll/payrollInlineInputs.test.ts`

Expected: PASS if the existing helpers already satisfy the approved contract. If either case fails, preserve the test as RED evidence and make only the minimal helper correction needed for the exact mismatch.

- [ ] **Step 3: Verify helper behavior after any minimal correction**

Run: `npx vitest run src/components/hr/payroll/payrollInlineInputs.test.ts`

Expected: PASS with all helper tests; explicit zero, mixed core/custom payloads, restoration, and partial failure retention are covered.

- [ ] **Step 4: Commit the helper coverage**

```powershell
git add src/components/hr/payroll/payrollInlineInputs.test.ts src/components/hr/payroll/payrollInlineInputs.ts
git commit -m "test(payroll): cover inline input batch payloads"
```

### Task 2: Render and Edit Six Fields Directly in the Main Table

**Files:**
- Modify: `src/components/hr/PayrollTab.test.tsx`
- Modify: `src/components/hr/PayrollTab.tsx:316-345,521-571,618-635`

**Interfaces:**
- Consumes: Task 1 draft/payload helpers and `payrollService.getPeriodInputs`, `getResults`, `getRun`, and `bulkSavePeriodInputs`.
- Produces: `showPeriodInputColumns: boolean` for column visibility and `inlineEditable: boolean` for input enabled state.

- [ ] **Step 1: Replace the opaque service proxy with stable named mocks**

Use a hoisted mock object whose functions can be arranged per test:

```ts
const payrollApi = vi.hoisted(() => ({
  getRun: vi.fn(),
  getResults: vi.fn(),
  getAdjustments: vi.fn(),
  getPeriodInputs: vi.fn(),
  getPolicies: vi.fn(),
  bulkSavePeriodInputs: vi.fn(),
}));

vi.mock("../../services/payrollService", () => ({ payrollService: payrollApi }));
```

In `beforeEach`, resolve policies/adjustments to `[]`, one locked attendance result for employee `e1`, no run, and `{ items: [], variables: [], editable: true, needsRefresh: false }` for period inputs.

- [ ] **Step 2: Add a failing draft-table interaction test**

Render `<PayrollTab canManage />`, wait for all six inputs by their existing labels, edit several values including `bonus = 0`, and assert:

```ts
expect(await screen.findByLabelText("agreedSalary-e1")).toBeEnabled();
expect(screen.getByLabelText("reconciledDays-e1")).toBeEnabled();
expect(screen.getByLabelText("reconciledHours-e1")).toBeEnabled();
expect(screen.getByLabelText("allowance-e1")).toBeEnabled();
expect(screen.getByLabelText("bonus-e1")).toBeEnabled();
expect(screen.getByLabelText("deduction-e1")).toBeEnabled();
```

Use `userEvent.tab()` after focusing the salary input and assert focus moves to `reconciledDays-e1`, proving native table order supports keyboard entry. Change salary and bonus, then assert the page reports `1 nhân viên có thay đổi chưa lưu` and exposes the shared `Lưu thay đổi` button.

- [ ] **Step 3: Run the draft-table test**

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx`

Expected: the direct-edit assertions may already pass because the underlying UI exists; retain them as characterization coverage. Any failure in field visibility, keyboard order, dirty state, or shared-save visibility is RED evidence for the minimal production change in Step 4.

- [ ] **Step 4: Separate visibility from editability in `PayrollTab`**

Add:

```ts
const showPeriodInputColumns = canManage;
const inlineEditable = showPeriodInputColumns
  && periodInputs.editable
  && (!run || run.status === "draft");
```

Replace header, row, empty-state `colSpan`, and footer conditions that currently use `inlineEditable` only to decide whether period-input columns exist with `showPeriodInputColumns`. Keep `inlineEditable` on the input `disabled` condition, restore buttons, dirty banner action, and saving logic.

- [ ] **Step 5: Add and pass the post-draft read-only test**

Arrange `getRun` with `{ status: "review", lines: [...] }` and period inputs with `{ editable: false }`. Assert the six labeled inputs remain present for a manager but are disabled, and no shared `Lưu thay đổi` action appears.

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx`

Expected: PASS; managers can inspect the same columns after `draft` without being able to edit them.

- [ ] **Step 6: Commit the rendered-table behavior**

```powershell
git add src/components/hr/PayrollTab.tsx src/components/hr/PayrollTab.test.tsx
git commit -m "feat(payroll): edit period inputs directly in payroll table"
```

### Task 3: Batch Save, Validation, and Partial Failure UI

**Files:**
- Modify: `src/components/hr/PayrollTab.test.tsx`
- Modify if required by failing tests: `src/components/hr/PayrollTab.tsx:348-365,521-528,655-671`

**Interfaces:**
- Consumes: `buildDirtyRows(...)`, `retainFailedDrafts(...)`, and `payrollApi.bulkSavePeriodInputs`.
- Produces: one reason-gated bulk request and durable failed-row drafts/errors.

- [ ] **Step 1: Add the successful batch-save test**

Arrange two employees, edit salary for `e1` and deduction for `e2`, open the single save dialog, and verify the save button is disabled until a non-empty reason is entered. Resolve the API with two success rows, submit, then assert exactly one call:

```ts
expect(payrollApi.bulkSavePeriodInputs).toHaveBeenCalledTimes(1);
expect(payrollApi.bulkSavePeriodInputs).toHaveBeenCalledWith(
  expect.any(String),
  expect.arrayContaining([
    expect.objectContaining({ employeeId: "e1", agreedSalary: 15_000_000, reason: "Đối soát tháng 8" }),
    expect.objectContaining({ employeeId: "e2", deduction: 250_000, reason: "Đối soát tháng 8" }),
  ]),
);
expect(payrollApi.calculate).not.toHaveBeenCalled();
```

Add `calculate: vi.fn()` to the stable service mock to make the non-recalculation assertion explicit.

- [ ] **Step 2: Run the successful batch-save test**

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx`

Expected: PASS if current save flow matches the contract; otherwise preserve the specific failure as RED evidence.

- [ ] **Step 3: Add the partial-failure test**

Resolve the bulk response with success for `e1` and `{ employeeId: "e2", status: "error", message: "Dữ liệu đã thay đổi" }` for `e2`. After submit, assert the dirty summary becomes `1 nhân viên có thay đổi chưa lưu`, the `e2` input retains the typed value, the row shows `Dữ liệu đã thay đổi`, and the dialog remains open for retry.

- [ ] **Step 4: Make only test-proven save-flow corrections**

If the tests fail, keep the existing algorithm and correct only the demonstrated gap. The required structure remains:

```ts
const response = await payrollService.bulkSavePeriodInputs(
  period,
  buildDirtyRows(inputDrafts, periodInputs.items, inputReason),
);
const retained = retainFailedDrafts(inputDrafts, Array.isArray(response) ? response : []);
setInputDrafts(retained.drafts);
setInputErrors(retained.errors);
await loadPeriodInputs();
await reload();
```

Do not call any calculate/recalculate endpoint from `saveInlineInputs`.

- [ ] **Step 5: Run UI and helper tests**

Run: `npx vitest run src/components/hr/PayrollTab.test.tsx src/components/hr/payroll/payrollInlineInputs.test.ts`

Expected: PASS; direct editing, one reason-gated bulk save, zero override, partial failure retention, and no automatic recalculation are verified.

- [ ] **Step 6: Commit save-flow coverage or corrections**

```powershell
git add src/components/hr/PayrollTab.tsx src/components/hr/PayrollTab.test.tsx
git commit -m "test(payroll): verify inline input bulk save"
```

### Task 4: Full Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: merge-readiness evidence.

- [ ] **Step 1: Run inline-input and period-input regression tests**

Run:

```powershell
npx vitest run src/components/hr/PayrollTab.test.tsx src/components/hr/payroll/payrollInlineInputs.test.ts server/service/payroll-period-input-operations.service.test.ts server/service/payroll-period-input-resolver.service.test.ts server/service/payroll-effective-input.service.test.ts server/service/payroll-run-calculate-operations.test.ts server/controller/payroll.controller.period-branch-scope.test.ts
```

Expected: PASS with no failures.

- [ ] **Step 2: Run TypeScript checking**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0; Vite and server esbuild complete successfully.

- [ ] **Step 4: Inspect scope and whitespace**

Run:

```powershell
git diff --check
git status --short
git diff --name-only origin/develop...HEAD
```

Expected: no whitespace errors and no changes to payroll policy, formula engine, revision, snapshot, or lifecycle code for this feature.
