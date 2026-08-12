# Edit Active Payroll Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers edit an active payroll formula, optionally recalculate the selected draft payroll period, and visually emphasize the active formula.

**Architecture:** Extend the existing action and update service to accept active policies with optimistic versioning. Keep the optional recalculation orchestration in `PayrollTab`, while `PayrollPolicyManager` owns the active-policy save confirmation and reports partial success if recalculation fails.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Express, Mongoose.

## Global Constraints

- Only users with the existing `payroll:manage` permission can mutate formulas.
- Recalculation targets only the payroll period currently selected in `PayrollTab`.
- Recalculation is available only when the run is absent or `draft`.
- Saving an active policy increments `version` and does not automatically mutate payroll revisions.
- A successful policy save is not rolled back when optional recalculation fails.

---

### Task 1: Permit active policy updates

**Files:**
- Modify: `server/service/payroll-policy-operations.service.ts`
- Test: `server/service/payroll-policy-version-operations.test.ts`
- Modify: `src/components/hr/payroll/payrollPolicyActions.ts`
- Test: `src/components/hr/payroll/payrollPolicyActions.test.ts`

**Interfaces:**
- `updatePayrollPolicy(companyCode, policyId, actorId, expectedVersion, input)` accepts `draft` and `active` status.
- `getPayrollPolicyActions(canManage, status)` includes `edit` for `active`.

- [ ] Write tests expecting active updates and the active `edit` action.
- [ ] Run the focused tests and confirm they fail because active editing is rejected or absent.
- [ ] Change the update query/state validation to preserve the current status while incrementing the version; add `edit` to active actions.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Add active-save decision logic

**Files:**
- Create: `src/components/hr/payroll/payrollPolicySaveDecision.ts`
- Create: `src/components/hr/payroll/payrollPolicySaveDecision.test.ts`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.test.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyConfirmDialog.tsx`

**Interfaces:**
- `canRecalculateAfterPolicySave(runStatus?: string): boolean` returns true only for absent or `draft` runs.
- `PayrollPolicyManager` accepts `runStatus?: string` and `onRecalculate?: () => Promise<void>`.

- [ ] Write failing unit/component tests for confirmation, save-only, save-and-recalculate, and locked-period behavior.
- [ ] Run focused tests and verify the missing dialog/actions cause the failures.
- [ ] Implement pending active edits and a confirmation dialog with save-only, save-and-update, and cancel actions.
- [ ] Ensure save happens before recalculation, failures before save block recalculation, and failures after save show a partial-success message.
- [ ] Run focused tests and confirm they pass.

### Task 3: Connect the selected period and highlight the active card

**Files:**
- Modify: `src/components/hr/PayrollTab.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.test.tsx`

**Interfaces:**
- `PayrollTab` passes `run?.status` and a callback wrapping the existing selected-period `processPeriod` operation.
- Active cards render a `Đang áp dụng` badge and deterministic indigo highlight classes.

- [ ] Write a failing component test for the active badge/highlight.
- [ ] Run it and confirm the current neutral card fails the assertion.
- [ ] Add the status-driven visual treatment and wire the selected-period callback.
- [ ] Run the manager and payroll processing test suites.

### Task 4: Final verification and delivery

**Files:**
- Verify all modified files.

- [ ] Run `npx vitest run src/components/hr/payroll/payrollPolicyActions.test.ts src/components/hr/payroll/payrollPolicySaveDecision.test.ts src/components/hr/payroll/PayrollPolicyManager.test.tsx server/service/payroll-policy-version-operations.test.ts src/components/hr/payroll/payrollProcessingAction.test.ts`.
- [ ] Run `yarn typecheck`.
- [ ] Run `git diff --check` and inspect the final diff against the spec.
- [ ] Commit with a scoped payroll message and push `feat/payroll-four-step-workflow` after rebasing on the latest `origin/develop` if requested by the delivery workflow.
