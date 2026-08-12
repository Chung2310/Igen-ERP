# Payroll Simple Paid Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the payroll payment card with a manager-only, confirmed action that changes a closed payroll run to paid without creating payment records.

**Architecture:** Extend the canonical payroll workflow with a `markPaid` action and expose it through the existing workflow controller/route pattern. Simplify `PayrollTab` so it no longer manages payment records and instead invokes the versioned workflow transition through `payrollService`.

**Tech Stack:** TypeScript, Express, Joi, React, Vitest, Testing Library

## Global Constraints

- Only `closed -> paid` is allowed.
- The action uses `payroll:manage`.
- No payroll payment record is created.
- `paid` remains immutable and cannot be reopened.
- The user must confirm the final transition.

---

### Task 1: Canonical paid transition

**Files:**
- Modify: `server/service/payroll-run-workflow-canonical.test.ts`
- Modify: `server/service/payroll-run-workflow.service.ts`
- Modify: `server/interface/payroll-audit.interface.ts`
- Modify: `server/model/payroll-audit.model.ts`

**Interfaces:**
- Consumes: `transitionPayrollRun()` and its optimistic concurrency contract.
- Produces: workflow action `markPaid`, transition `closed -> paid`, and audit action `mark_paid`.

- [ ] **Step 1: Write failing domain tests** asserting `markPaid` moves `closed` to `paid`, audits the transition, and rejects `draft`, `review`, and `paid`.
- [ ] **Step 2: Run `yarn vitest run server/service/payroll-run-workflow-canonical.test.ts`** and confirm failure because `markPaid` is unsupported.
- [ ] **Step 3: Add the minimal workflow rule** with `from: ["closed"]`, `to: "paid"`, actor/time fields, and `mark_paid` audit support.
- [ ] **Step 4: Re-run the domain test** and confirm it passes.

### Task 2: Protected HTTP endpoint and client

**Files:**
- Modify: `server/router/payroll-run-workflow.router.test.ts`
- Modify: `server/router/payroll.router.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `src/services/payrollService.ts`

**Interfaces:**
- Consumes: workflow action `markPaid` and `workflowTransitionSchema` body `{ expectedVersion: number }`.
- Produces: `POST /runs/:id/mark-paid`, guarded by `payroll:manage`, and `payrollService.markPaid(runId, payload)`.

- [ ] **Step 1: Add a failing route test** expecting the new endpoint to use `payroll:manage`.
- [ ] **Step 2: Run the route test** and confirm the route is absent.
- [ ] **Step 3: Register the controller handler and route, then add the client method.**
- [ ] **Step 4: Re-run route and workflow tests** and confirm they pass.

### Task 3: Replace payment card with confirmed button

**Files:**
- Create: `src/components/hr/payroll/payrollPaidAction.ts`
- Create: `src/components/hr/payroll/payrollPaidAction.test.ts`
- Modify: `src/components/hr/PayrollTab.tsx`

**Interfaces:**
- Consumes: run status, `canManage`, run id/version, and `payrollService.markPaid`.
- Produces: `canMarkPayrollPaid(canManage, status)` used to gate the final action.

- [ ] **Step 1: Write a failing policy test** proving only managers viewing a closed run can see the action.
- [ ] **Step 2: Run the policy test** and confirm failure because the helper is absent.
- [ ] **Step 3: Implement the policy helper and simplify `PayrollTab`** by removing payment loading/state/card/modal code and adding a confirmation modal plus **Đánh dấu đã thanh toán** button.
- [ ] **Step 4: Run the policy, workflow, and route tests** and confirm they pass.

### Task 4: Full verification and delivery

**Files:**
- Verify all modified files and documentation.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verified branch commit pushed to `origin/feat/payroll-four-step-workflow`.

- [ ] **Step 1: Run targeted payroll tests.**
- [ ] **Step 2: Run `yarn typecheck`.**
- [ ] **Step 3: Inspect `git diff --check` and the final diff against this plan.**
- [ ] **Step 4: Commit with `feat: simplify payroll paid transition` and push the feature branch.**
