# Vietnam Payroll Operations 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build payroll-run creation, attendance synchronization, preflight issues, immutable attendance locking, and the first workflow UI.

**Architecture:** Extend the existing period API through a backward-compatible adapter while introducing run IDs, a pure state machine, typed snapshots, and idempotent jobs. Keep attendance reads in the existing attendance payroll service and persist normalized snapshots in payroll models.

**Tech Stack:** TypeScript, Express, Mongoose, Joi, React, Vitest.

## Global Constraints

- Scope all reads and writes by `companyCode` and `branchId`.
- Require `expectedVersion` for mutations; return HTTP 409 with the current version on conflict.
- Permit attendance resynchronization only while a run is `draft`.
- Treat locked snapshots as immutable and never recalculate closed historical runs.
- Preserve existing `/periods/:periodKey/*` endpoints through adapters.

---

### Task 1: Define the run state machine and attendance snapshot

**Files:**
- Create: `server/interface/payroll-operations.interface.ts`
- Create: `server/service/payroll-run-state.service.ts`
- Test: `server/service/payroll-run-state.service.test.ts`
- Modify: `server/interface/payroll-period.interface.ts`

**Interfaces:**
- Consumes: existing `IPayrollRun` and attendance calculation inputs.
- Produces: `PayrollRunStatus`, `PayrollRunType`, `PayrollIssue`, `PayrollAttendanceSnapshot`, and `assertPayrollTransition(from, to)`.

- [ ] **Step 1: Write the failing state-machine tests**

```ts
it("allows the operational happy path", () => {
  expect(() => assertPayrollTransition("draft", "attendance_locked")).not.toThrow();
  expect(() => assertPayrollTransition("attendance_locked", "calculated")).not.toThrow();
});
it("never reopens a closed run", () => {
  expect(() => assertPayrollTransition("closed", "calculated")).toThrow(/PAYROLL_INVALID_TRANSITION/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run server/service/payroll-run-state.service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the types and transition table**

```ts
export type PayrollRunStatus = "draft" | "attendance_locked" | "calculated" | "reviewed" | "approved" | "closed" | "partially_paid" | "paid";
const transitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  draft: ["attendance_locked"], attendance_locked: ["calculated"],
  calculated: ["calculated", "reviewed"], reviewed: ["calculated", "approved"],
  approved: ["calculated", "closed"], closed: ["partially_paid", "paid"],
  partially_paid: ["closed", "paid"], paid: ["partially_paid"],
};
```

- [ ] **Step 4: Run the focused test and `npm run typecheck`**

Expected: PASS and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add server/interface/payroll-operations.interface.ts server/interface/payroll-period.interface.ts server/service/payroll-run-state.service.ts server/service/payroll-run-state.service.test.ts
git commit -m "feat: define payroll operations state machine"
```

### Task 2: Persist versioned runs, snapshots, issues, and jobs

**Files:**
- Modify: `server/model/payroll-run.model.ts`
- Create: `server/model/payroll-attendance-snapshot.model.ts`
- Create: `server/model/payroll-operation-job.model.ts`
- Test: `server/model/payroll-operations.model.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: `PayrollAttendanceSnapshotModel`, `PayrollOperationJobModel`, and versioned `PayrollRunModel` documents.

- [ ] **Step 1: Write failing schema tests**

```ts
it("requires one scoped regular run per period", () => {
  expect(PayrollRunModel.schema.indexes()).toContainEqual([
    { companyCode: 1, branchId: 1, startDate: 1, endDate: 1, type: 1 },
    expect.objectContaining({ unique: true }),
  ]);
});
it("stores a unique idempotency key per company", () => {
  expect(PayrollOperationJobModel.schema.indexes()).toContainEqual([
    { companyCode: 1, idempotencyKey: 1 }, expect.objectContaining({ unique: true }),
  ]);
});
```

- [ ] **Step 2: Run `npx vitest run server/model/payroll-operations.model.test.ts`**

Expected: FAIL with missing schemas or indexes.

- [ ] **Step 3: Implement schemas** with optimistic concurrency, `version`, run type/date range, issue arrays, totals, and the tested compound indexes.
- [ ] **Step 4: Run the model test**; expect PASS.
- [ ] **Step 5: Commit**

```bash
git add server/model/payroll-run.model.ts server/model/payroll-attendance-snapshot.model.ts server/model/payroll-operation-job.model.ts server/model/payroll-operations.model.test.ts
git commit -m "feat: persist payroll attendance workflow"
```

### Task 3: Add create, sync, issue, and lock APIs

**Files:**
- Create: `server/service/payroll-run-operations.service.ts`
- Create: `server/validation/payroll-run.validation.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/router/payroll-run-operations.router.test.ts`

**Interfaces:**
- Produces: `createRun`, `syncAttendance`, `listIssues`, and `lockAttendance` service methods.

- [ ] **Step 1: Write failing router cases** for branch isolation, overlapping periods, unresolved attendance approvals, idempotent sync, locking, and stale `expectedVersion`.
- [ ] **Step 2: Run `npx vitest run server/router/payroll-run-operations.router.test.ts`**; expect 404 or missing exports.
- [ ] **Step 3: Implement Joi requests** requiring ISO dates, run type, optional parent run, `expectedVersion`, and `Idempotency-Key` for sync.
- [ ] **Step 4: Implement transactional operations** that normalize existing attendance results, persist the snapshot at lock, increment version, and append audit records.
- [ ] **Step 5: Mount routes**

```ts
payrollRouter.post("/runs", requirePermission("payroll:prepare"), payrollController.createOperationalRun);
payrollRouter.post("/runs/:id/sync-attendance", requirePermission("payroll:prepare"), payrollController.syncAttendance);
payrollRouter.post("/runs/:id/lock-attendance", requirePermission("payroll:prepare"), payrollController.lockAttendance);
payrollRouter.get("/runs/:id/issues", requirePermission("payroll:read"), payrollController.listRunIssues);
```

- [ ] **Step 6: Run router and attendance payroll tests**; expect PASS.
- [ ] **Step 7: Commit**

```bash
git add server/service/payroll-run-operations.service.ts server/validation/payroll-run.validation.ts server/controller/payroll.controller.ts server/router/payroll.router.ts server/router/payroll-run-operations.router.test.ts
git commit -m "feat: add payroll attendance workflow api"
```

### Task 4: Build the phase 2A workflow UI

**Files:**
- Modify: `src/services/payrollService.ts`
- Create: `src/components/hr/payroll/PayrollRunWizard.tsx`
- Create: `src/components/hr/payroll/PayrollIssueList.tsx`
- Modify: `src/components/hr/PayrollTab.tsx`
- Test: `src/components/hr/payroll/PayrollRunWizard.test.tsx`

**Interfaces:**
- Consumes: run, job, snapshot summary, and issue API payloads.
- Produces: reusable wizard steps for later phases.

- [ ] **Step 1: Write failing UI tests** for create, sync progress, blocking issues, retry, and lock confirmation.
- [ ] **Step 2: Run `npx vitest run src/components/hr/payroll/PayrollRunWizard.test.tsx`**; expect missing component failure.
- [ ] **Step 3: Add typed service methods** `createRun`, `syncAttendance`, `getRunIssues`, `lockAttendance`, and `getOperationJob`.
- [ ] **Step 4: Implement wizard and issue list**; disable lock while blocking issues or active jobs exist and preserve polling after remount.
- [ ] **Step 5: Run UI tests, `npm run typecheck`, and `npm run build`**; expect exit code 0.
- [ ] **Step 6: Commit**

```bash
git add src/services/payrollService.ts src/components/hr/payroll/PayrollRunWizard.tsx src/components/hr/payroll/PayrollIssueList.tsx src/components/hr/PayrollTab.tsx src/components/hr/payroll/PayrollRunWizard.test.tsx
git commit -m "feat: add payroll attendance workflow ui"
```
