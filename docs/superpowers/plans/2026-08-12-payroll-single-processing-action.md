# Payroll Single Processing Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three draft payroll controls with one repeatable manager action that synchronizes attendance, locks it, and creates or refreshes payroll in order.

**Architecture:** Add a focused sequential orchestrator whose three injected operations make ordering and stop-on-error behavior independently testable. An HTTP adapter reuses the existing period handlers, while a small frontend policy controls visibility and labels for the single button.

**Tech Stack:** TypeScript, Express, React, Vitest

## Global Constraints

- Execution order is synchronize attendance, lock attendance, then calculate payroll.
- Stop immediately at the failed stage and identify it in the response.
- The action is repeatable only while no run exists or the run is `draft`.
- The endpoint uses `payroll:manage`.
- Existing individual endpoints remain available for compatibility.

---

### Task 1: Sequential orchestration contract

**Files:**
- Create: `server/service/payroll-period-processing.service.ts`
- Create: `server/service/payroll-period-processing.service.test.ts`

**Interfaces:**
- Produces: `processPayrollPeriod(operations)` where `operations` contains async `syncAttendance`, `lockAttendance`, and `calculatePayroll` functions.
- Produces: `PayrollPeriodProcessingError` with `stage` and original message.

- [ ] Write tests asserting strict order and the returned calculation result.
- [ ] Write parameterized tests asserting each failure prevents all later calls and exposes `sync_attendance`, `lock_attendance`, or `calculate_payroll`.
- [ ] Run the test and verify RED because the module is absent.
- [ ] Implement the minimal orchestrator and error class.
- [ ] Re-run the test and verify GREEN.

### Task 2: Manager endpoint

**Files:**
- Modify: `server/router/payroll-run-workflow.router.test.ts`
- Modify: `server/router/payroll.router.ts`
- Modify: `server/controller/payroll.controller.ts`

**Interfaces:**
- Consumes: `processPayrollPeriod`.
- Produces: `POST /periods/:periodKey/process`, guarded by `payroll:manage`.

- [ ] Add a failing route test for `payroll:manage`.
- [ ] Run it and verify the route is absent.
- [ ] Add a controller adapter that rejects non-draft existing runs, invokes the existing snapshot/lock/create-run handlers through a response-capturing adapter, and maps stage failures to an error response containing `stage`.
- [ ] Register the route and re-run route plus orchestration tests.

### Task 3: Single frontend action

**Files:**
- Create: `src/components/hr/payroll/payrollProcessingAction.ts`
- Create: `src/components/hr/payroll/payrollProcessingAction.test.ts`
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/PayrollTab.tsx`

**Interfaces:**
- Produces: `getPayrollProcessingAction(runStatus, loading)` returning visibility, default label, and loading label.
- Produces: `payrollService.processPeriod(periodKey)`.

- [ ] Add failing policy tests for no-run, draft, loading, and later states.
- [ ] Run them and verify RED because the module is absent.
- [ ] Implement the minimal policy and service method.
- [ ] Replace the three buttons and manual-sync warning with one disabled-while-loading button calling `processPeriod`.
- [ ] Re-run policy and payroll tests and verify GREEN.

### Task 4: Verification and delivery

**Files:**
- Verify all changed files.

**Interfaces:**
- Produces: a verified commit on `feat/payroll-four-step-workflow` pushed to origin.

- [ ] Run targeted orchestration, route, policy, and payroll workflow tests.
- [ ] Run `yarn typecheck`.
- [ ] Run `git diff --check` and review the diff against the spec.
- [ ] Commit with `feat: combine payroll draft processing actions` and push the feature branch.
