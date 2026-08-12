# Payroll Policy Form Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the payroll policy JSON editor with a Vietnamese four-step form wizard while preserving the existing API payload.

**Architecture:** Add a typed form model and pure conversion/validation module between UI-friendly values and the persisted payroll policy definition. Keep list actions in `PayrollPolicyManager`, move the modal into a focused wizard component, and test pure policy rules independently from component interaction.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Vitest, Testing Library

## Global Constraints

- Keep the current payroll policy API and JSON storage shape unchanged.
- Display money in VND and rates as familiar percentages; never expose JSON in the UI.
- Reuse the existing `manager` permission gate.
- Editing a policy used by a draft payroll period remains allowed and does not trigger recalculation.
- A policy used by a finalized payroll period remains protected by existing server rules.

---

### Task 1: Typed form conversion and validation

**Files:**
- Create: `src/components/hr/payroll/payrollPolicyForm.ts`
- Test: `src/components/hr/payroll/payrollPolicyForm.test.ts`

**Interfaces:**
- Produces: `PayrollPolicyForm`, `PayrollPolicyDefinition`, `createDefaultPayrollPolicyForm()`, `policyDefinitionToForm()`, `payrollPolicyFormToDefinition()`, `validatePayrollPolicyStep()` and `validatePayrollPolicyForm()`.

- [ ] **Step 1: Write failing tests** for default values, persisted decimal rates to displayed percentages, reverse conversion, preservation of supported fund fields, required fields, date order, numeric ranges, and progressive tax bracket ordering.
- [ ] **Step 2: Run `npx vitest run src/components/hr/payroll/payrollPolicyForm.test.ts`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement the typed form model and pure conversion/validation functions.** Normalize dates to `YYYY-MM-DD`, represent optional top-bracket bounds as an empty string in the form, and convert percent values by multiplying/dividing by 100 only at the persistence boundary.
- [ ] **Step 4: Run the focused test** and expect all form-model tests to pass.
- [ ] **Step 5: Commit** with `feat(payroll): add policy form model`.

### Task 2: Four-step policy editor modal

**Files:**
- Create: `src/components/hr/payroll/PayrollPolicyFormModal.tsx`
- Modify: `src/components/hr/payroll/payrollPolicyForm.ts`
- Test: `src/components/hr/payroll/PayrollPolicyFormModal.test.tsx`

**Interfaces:**
- Consumes: Task 1 form model and validation functions.
- Produces: `PayrollPolicyFormModal` accepting `mode`, `initialDefinition`, `saving`, `onCancel`, and `onSave` props.

- [ ] **Step 1: Write failing component tests** proving the modal renders four named steps, blocks invalid forward navigation, retains values when navigating backward, adds/removes tax brackets, confirms unsaved close, and submits a converted definition from the final step.
- [ ] **Step 2: Run `npx vitest run src/components/hr/payroll/PayrollPolicyFormModal.test.tsx`** and verify failure because the modal does not exist.
- [ ] **Step 3: Implement the modal shell and step navigation.** Use semantic inputs, inline errors, a visible progress header, scrollable content, and responsive two-column field groups.
- [ ] **Step 4: Implement each step.** General fields cover identity/dates/wage/reference; insurance covers caps and fund employee/employer percentages; tax covers deductions, withholding and editable brackets; overtime covers multipliers, rounding, and summary.
- [ ] **Step 5: Add close protection and submission behavior.** Confirm only when values changed, retain state on failed parent save, and disable actions while saving.
- [ ] **Step 6: Run the focused component test** and expect it to pass.
- [ ] **Step 7: Commit** with `feat(payroll): add policy form wizard`.

### Task 3: Integrate create, edit, and clone flows

**Files:**
- Modify: `src/components/hr/payroll/PayrollPolicyManager.tsx`
- Modify: `src/components/hr/payroll/PayrollPolicyFormModal.tsx`
- Test: `src/components/hr/payroll/PayrollPolicyManager.test.tsx`

**Interfaces:**
- Consumes: `PayrollPolicyFormModal` and the existing `payrollService` lifecycle methods.
- Produces: one consistent modal flow for create, edit and clone without `window.prompt` or JSON textareas.

- [ ] **Step 1: Write failing integration tests** for create calling `createPolicy`, edit calling `updatePolicy` with `expectedVersion`, clone opening prefilled data while requiring a new code and calling `clonePolicy`, and save failures leaving the modal open.
- [ ] **Step 2: Run `npx vitest run src/components/hr/payroll/PayrollPolicyManager.test.tsx`** and verify the JSON-editor behavior fails the new expectations.
- [ ] **Step 3: Replace editor JSON state with modal mode and initial definition state.** Keep server-owned fields out of editable definitions.
- [ ] **Step 4: Route saves by mode.** Create sends the definition, edit adds `expectedVersion`, and clone sends the new code/name through the existing clone endpoint after presenting the full copied configuration for review.
- [ ] **Step 5: Update Vietnamese labels and guidance** so draft editability, locked finalized versions, and the absence of automatic recalculation are clear.
- [ ] **Step 6: Run the focused manager test** and expect it to pass.
- [ ] **Step 7: Commit** with `feat(payroll): integrate policy wizard`.

### Task 4: Regression verification

**Files:**
- Modify only files required to resolve failures introduced by Tasks 1–3.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified payroll policy wizard with no TypeScript regression.

- [ ] **Step 1: Run `npx vitest run src/components/hr/payroll/payrollPolicyForm.test.ts src/components/hr/payroll/PayrollPolicyFormModal.test.tsx src/components/hr/payroll/PayrollPolicyManager.test.tsx`.** Expect all focused tests to pass.
- [ ] **Step 2: Run `npx vitest run server/service/payroll-policy.service.test.ts server/service/payroll-policy-version-operations.test.ts server/controller/payroll-policy.controller.test.ts`.** Expect existing server lifecycle tests to pass.
- [ ] **Step 3: Run `yarn typecheck`.** Expect TypeScript to exit with code 0.
- [ ] **Step 4: Run `git diff --check`.** Expect no whitespace errors.
- [ ] **Step 5: Review the final diff** for JSON textarea remnants, accidental API changes, untranslated labels, and unrelated edits.
- [ ] **Step 6: Commit any verification fixes** with `fix(payroll): finalize policy wizard` only if Step 5 requires changes.
