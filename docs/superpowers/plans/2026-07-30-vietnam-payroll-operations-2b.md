# Vietnam Payroll Operations 2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the detailed payroll engine, effective-date resolution, calculation revisions, adjustments, warnings, and payroll-line review UI.

**Architecture:** Resolve all effective-dated inputs into immutable employee calculation inputs, execute the foundation engine in an idempotent job, and atomically activate a completed revision. A failed revision never replaces the last successful result.

**Tech Stack:** TypeScript, Express, Mongoose transactions, Joi, React, Vitest.

## Global Constraints

- Requires the foundation plan and phase 2A to be complete.
- Only `attendance_locked` or `calculated` runs may calculate.
- All monetary values are integer VND.
- Every line records source IDs, effective segments, policy ID, formula version, warnings, and calculation revision.
- Existing untyped payroll lines remain readable through an adapter.

---

### Task 1: Resolve effective-dated payroll inputs

**Files:**
- Create: `server/service/payroll-effective-input.service.ts`
- Test: `server/service/payroll-effective-input.service.test.ts`

**Interfaces:**
- Produces: `resolveDetailedPayrollInput(employeeId, snapshot, period): Promise<DetailedPayrollInput>`.

- [ ] Write failing tests for mid-period salary changes, probation-to-official transition, dependent effective dates, missing policy, and overlapping salary terms.
- [ ] Run `npx vitest run server/service/payroll-effective-input.service.test.ts`; expect missing-module failure.
- [ ] Implement interval intersection and deterministic segment ordering; return `PayrollIssue[]` rather than generic errors for employee data problems.
- [ ] Run the test; expect PASS.
- [ ] Commit with `feat: resolve effective payroll inputs`.

### Task 2: Persist calculation revisions and typed line snapshots

**Files:**
- Create: `server/interface/payroll-revision.interface.ts`
- Create: `server/model/payroll-calculation-revision.model.ts`
- Modify: `server/model/payroll-run.model.ts`
- Test: `server/model/payroll-calculation-revision.model.test.ts`

**Interfaces:**
- Produces: `PayrollCalculationRevisionModel`, typed `PayrollLineSnapshot`, and `activeRevisionId` on a run.

- [ ] Write failing tests for immutable completed revisions, unique revision number per run, and legacy-line adaptation.
- [ ] Run the model test; expect failure.
- [ ] Implement revision states `running | completed | failed`, typed totals, line snapshots, issue arrays, and index `{ runId: 1, revision: 1 }` unique.
- [ ] Add `adaptLegacyPayrollLine(line): PayrollLineSnapshot` without recalculating historical values.
- [ ] Run tests and commit with `feat: persist payroll calculation revisions`.

### Task 3: Calculate and recalculate runs safely

**Files:**
- Create: `server/service/payroll-run-calculation.service.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/service/payroll-run-calculation.service.test.ts`
- Test: `server/router/payroll-calculation.router.test.ts`

**Interfaces:**
- Produces: `calculateRun({ runId, actor, expectedVersion, idempotencyKey })`.

- [ ] Write failing tests proving a failed calculation preserves `activeRevisionId`, retry returns the same job, successful calculation increments revision, and blocking issues keep the run out of `calculated`.
- [ ] Run both focused suites; expect failures.
- [ ] Implement per-employee resolution and engine execution, collect issues, persist failed revisions, and atomically activate only completed revisions.
- [ ] Add `POST /runs/:id/calculate` and `/recalculate` guarded by `payroll:prepare`.
- [ ] Run focused tests plus foundation engine tests; expect PASS.
- [ ] Commit with `feat: calculate versioned payroll runs`.

### Task 4: Add adjustment review and payroll-line UI

**Files:**
- Modify: `server/model/payroll-adjustment.model.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Create: `src/components/hr/payroll/PayrollLinesTable.tsx`
- Create: `src/components/hr/payroll/PayrollLineDrawer.tsx`
- Create: `src/components/hr/payroll/PayrollReviewQueue.tsx`
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/PayrollTab.tsx`
- Test: `src/components/hr/payroll/PayrollReviewQueue.test.tsx`

**Interfaces:**
- Produces: create/update/approve/reject adjustment endpoints and reusable line-detail UI.

- [ ] Write failing API tests for adjustment approval, stale version, closed-run rejection, and recalculation-required marking.
- [ ] Write failing UI tests for issue filters, warning acknowledgement with reason, and adjustment approval.
- [ ] Implement adjustment lifecycle `draft | pending | approved | rejected | snapshotted`; mark active calculations stale after money-changing updates.
- [ ] Implement the table, drawer, and queue using typed service responses.
- [ ] Run payroll API/UI suites, typecheck, and build; expect exit code 0.
- [ ] Commit with `feat: add payroll calculation review workflow`.
