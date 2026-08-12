# Inline Draft Payroll Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers edit and persist period-specific inputs directly in the draft payroll table.

**Architecture:** Extend the existing period-input save contract with explicit field clearing, then use a pure client helper to merge source, persisted, and unsaved values. `PayrollTab` owns drafts by employee and saves all dirty rows through the existing bulk endpoint without recalculating payroll.

**Tech Stack:** React, TypeScript, Express/Mongoose, Vitest.

## Global Constraints

- Editing is available only when the period has no run or the run is `draft`.
- Explicit zero is an override; restoring source uses `clearFields`.
- One reason applies to each bulk save, and partial failures retain local edits.
- Saving marks an existing draft run stale but never recalculates it automatically.

---

### Task 1: Explicit restore support

**Files:**
- Modify: `server/service/payroll-period-input-operations.service.ts`
- Test: `server/service/payroll-period-input-operations.service.test.ts`

**Interfaces:**
- Consumes: bulk rows containing `clearFields: string[]`.
- Produces: atomic `$unset` updates for supported core fields and `customValues.<code>` paths.

- [ ] Add a failing service test asserting cleared fields are unset, excluded from `$set`, audited, and still mark a draft run stale.
- [ ] Run `yarn vitest run server/service/payroll-period-input-operations.service.test.ts` and confirm the new assertion fails.
- [ ] Validate clearable field names, build `$unset`, and record `clearFields` in audit metadata.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Inline draft state

**Files:**
- Create: `src/components/hr/payroll/payrollInlineInputs.ts`
- Create: `src/components/hr/payroll/payrollInlineInputs.test.ts`

**Interfaces:**
- Produces: `setDraftValue`, `restoreDraftField`, `buildDirtyRows`, and `retainFailedDrafts` pure helpers.

- [ ] Write failing tests proving explicit zero, restore semantics, employee-keyed state, payload creation, and partial-success retention.
- [ ] Run the focused Vitest file and confirm failures are caused by missing helpers.
- [ ] Implement the minimal immutable helper functions and types.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Payroll table integration

**Files:**
- Modify: `src/components/hr/PayrollTab.tsx`

**Interfaces:**
- Consumes: `payrollService.getPeriodInputs`, `bulkSavePeriodInputs`, and Task 2 helpers.
- Produces: editable draft cells, source restore controls, batch reason modal, row errors, and stale-payroll notice.

- [ ] Remove the standalone `PayrollPeriodInputsTable` rendering and load input metadata with the selected period.
- [ ] Add editable core/custom-variable columns to both no-run and draft-run table views; keep later statuses read-only.
- [ ] Add amber unsaved and cyan persisted styling, source comparison, restore actions, and row errors.
- [ ] Add one `Lưu thay đổi` action and reason dialog; apply partial-save results without dropping failed drafts.
- [ ] Reload successful persisted rows and show `Bảng lương cần cập nhật` without triggering calculation.

### Task 4: Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-12-inline-draft-payroll-inputs.md`

- [ ] Run the two focused period-input test files and the inline helper tests.
- [ ] Run `yarn typecheck`.
- [ ] Review `git diff --check` and the final diff for accidental unrelated changes.
- [ ] Commit the verified implementation on `feat/payroll-four-step-workflow`.
