# Payroll Policy Activation Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers confirm replacement of overlapping active payroll policies and use consistent in-app confirmation dialogs for replacement, retirement, and deletion.

**Architecture:** Extend activation with an optional `replaceOverlaps` command. The service re-reads and adjusts overlapping policies and activates the draft in one Mongo transaction, while a reusable React confirmation dialog owns pending/error behavior for all destructive policy actions.

**Tech Stack:** TypeScript 5.8, Express, Joi, Mongoose transactions, React 19, Vitest, Testing Library

## Global Constraints

- Keep `PAYROLL_POLICY_OVERLAP` for compatibility when replacement is not explicitly confirmed.
- Scope every read and write by `companyCode`.
- Preserve a valid historical active window by ending older policies one day before the new policy; retire policies that cannot retain a valid window.
- Do not recalculate finalized or draft payroll periods automatically.
- Do not use `window.confirm` or `window.prompt` for replace, retire, or delete actions.

---

### Task 1: Replacement classification rules

**Files:**
- Modify: `server/service/payroll-policy.service.ts`
- Test: `server/service/payroll-policy.service.test.ts`

**Interfaces:**
- Produces: `replacementForPolicy(active, replacementStart)` returning `{ action: "truncate"; effectiveTo: Date }` or `{ action: "retire" }`.

- [ ] Write failing tests proving an earlier active policy truncates to the preceding UTC calendar day and same/later starts retire.
- [ ] Run `npx vitest run server/service/payroll-policy.service.test.ts`; expect new tests to fail because the helper is missing.
- [ ] Implement the pure UTC date/classification helper without mutating inputs.
- [ ] Re-run the focused test and expect all tests to pass.

### Task 2: Atomic replacement activation

**Files:**
- Modify: `server/service/payroll-policy-operations.service.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/validation/payroll-run.validation.ts`
- Test: `server/service/payroll-policy-version-operations.test.ts`
- Test: `server/controller/payroll-policy.controller.test.ts`

**Interfaces:**
- Consumes: `replacementForPolicy`.
- Produces: `activatePayrollPolicy(companyCode, policyId, actorId, { replaceOverlaps?: boolean })` and activation schema `{ replaceOverlaps: boolean = false }`.

- [ ] Write failing service tests for unchanged overlap rejection, truncation, retirement, multiple overlaps, session propagation, audit metadata, and transaction cleanup.
- [ ] Write failing controller tests proving the optional flag is stripped/validated and passed to the service path.
- [ ] Run both focused files; expect failures describing missing replacement behavior.
- [ ] Add `activationPolicySchema` and pass its validated value from the controller.
- [ ] Implement a transaction wrapper around replacement activation. Re-read the draft and overlaps within the session, condition updates on current status/window, pass the session to policy/audit writes, and throw conflict if any conditional update misses.
- [ ] Re-run both focused files and expect all tests to pass.

### Task 3: Standard policy confirmation dialog

**Files:**
- Create: `src/components/hr/payroll/PayrollPolicyConfirmDialog.tsx`
- Test: `src/components/hr/payroll/PayrollPolicyConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `PayrollPolicyConfirmDialog` with `title`, `description`, `impact`, `confirmLabel`, `tone`, `pending`, `error`, `onCancel`, and `onConfirm` props.

- [ ] Write failing component tests for content, cancel, confirm, destructive styling, pending disabled state, and inline error.
- [ ] Run the focused test; expect failure because the component does not exist.
- [ ] Implement an accessible modal with dialog semantics, backdrop, buttons, pending label, and inline alert.
- [ ] Re-run the focused test and expect it to pass.

### Task 4: Integrate replace, retire, and delete confirmations

**Files:**
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyManager.test.tsx`

**Interfaces:**
- Consumes: activation payload and `PayrollPolicyConfirmDialog`.
- Produces: `activatePolicy(id, { replaceOverlaps?: boolean })` and confirmation state for `replace`, `retire`, and `delete`.

- [ ] Add failing manager tests: overlap opens replacement dialog; cancel makes no second request; confirm retries with `{ replaceOverlaps: true }`; retire/delete open standard dialogs; API failure remains visible with dialog open.
- [ ] Run the focused manager test and confirm expected failures against current native confirmation behavior.
- [ ] Extend the service client activation signature.
- [ ] Replace native confirmations with typed dialog state and a single pending/error action executor.
- [ ] Detect `PAYROLL_POLICY_OVERLAP` reliably by extending payroll request errors with `code` and optional `details`, then open the replacement dialog.
- [ ] Re-run manager/dialog tests and expect all tests to pass.

### Task 5: Verification

**Files:**
- Modify only files required by failures caused by Tasks 1–4.

**Interfaces:**
- Produces: verified branch ready to push.

- [ ] Run all payroll policy unit, service, controller, and component tests; expect zero failures.
- [ ] Run `yarn typecheck`; expect exit code 0.
- [ ] Run `git diff --check`; expect no whitespace errors.
- [ ] Search policy UI for `window.confirm` and `window.prompt`; expect no matches.
- [ ] Review the diff against the design, commit implementation, and leave the worktree clean.
