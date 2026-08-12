# Payroll Policy Version Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver manager-controlled payroll policy version CRUD, lifecycle actions, safe deletion, immutable payroll references, and a usable configuration panel.

**Architecture:** Extend the focused policy operations service with update/clone/delete commands and an isolated finalized-run usage query. Stamp selected policy identity into both operational revisions and legacy payroll lines. Add a dedicated React policy manager component whose action policy is independently tested.

**Tech Stack:** TypeScript, Express, Mongoose, Joi, React, Vitest

## Global Constraints

- All mutations require `payroll:manage` and company scope.
- Only draft policies are editable.
- Clone always creates a new draft with a unique code.
- Only draft or retired policies may be deleted.
- Policies referenced by closed or paid runs cannot be deleted.
- Historical payroll snapshots are never rewritten.

---

### Task 1: Policy lifecycle operations

**Files:**
- Modify: `server/service/payroll-policy-operations.service.ts`
- Modify: `server/controller/payroll-policy.controller.test.ts`
- Modify: `server/validation/payroll-run.validation.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Modify: `server/router/payroll-run-workflow.router.test.ts`

**Interfaces:**
- Produces: `updatePayrollPolicy`, `clonePayrollPolicy`, `deletePayrollPolicy` and PATCH/POST clone/DELETE routes.

- [ ] Add failing tests for draft-only optimistic update, sanitized clone, active-delete rejection, finalized-run deletion rejection, successful unused deletion, audit, company scope, and route permission.
- [ ] Run tests and verify RED because operations/routes are absent.
- [ ] Implement validation, operations, controller handlers, and routes.
- [ ] Re-run tests and verify GREEN.

### Task 2: Immutable calculation references

**Files:**
- Modify: `server/interface/payroll-revision.interface.ts`
- Modify: `server/service/payroll-run-calculation.service.ts`
- Modify: `server/service/payroll-run-vietnam-integration.test.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/model/payroll-run.model.ts`

**Interfaces:**
- Produces line fields `policyId`, `policyVersion`, `policyCode`, and `policyName` alongside `formulaVersion`.

- [ ] Add failing operational and legacy assertions for policy identity snapshots.
- [ ] Run tests and verify RED for missing code/name fields.
- [ ] Extend line types/models and both calculation paths with immutable policy identity.
- [ ] Re-run calculation tests and verify GREEN.

### Task 3: Policy configuration UI

**Files:**
- Create: `src/components/hr/payroll/payrollPolicyActions.ts`
- Create: `src/components/hr/payroll/payrollPolicyActions.test.ts`
- Create: `src/components/hr/payroll/PayrollPolicyManager.tsx`
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/PayrollTab.tsx`

**Interfaces:**
- Produces lifecycle-valid manager actions and a policy editor/list panel.

- [ ] Add failing action-policy tests for draft, active, retired, and read-only users.
- [ ] Run tests and verify RED because the policy is absent.
- [ ] Implement service calls and a focused manager panel supporting create/edit/clone/activate/retire/delete with confirmations and reload.
- [ ] Mount the panel in payroll configuration for managers and re-run tests.

### Task 4: Verification and delivery

**Files:**
- Verify all changed files and this plan.

**Interfaces:**
- Produces a verified commit pushed to `origin/feat/payroll-four-step-workflow`.

- [ ] Run policy, calculation, route, and payroll workflow tests.
- [ ] Run `yarn typecheck`.
- [ ] Run `git diff --check` and review spec coverage.
- [ ] Commit with `feat: manage payroll policy versions` and push.
