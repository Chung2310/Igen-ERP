# Payroll Formula Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-scoped no-code formula library and apply active formulas to custom payroll buckets during draft payroll calculation.

**Architecture:** A pure evaluator owns the approved variable catalog, validation, condition evaluation, expression evaluation, rounding, and trace creation. A Mongoose model and REST service own formula lifecycle/versioning. The payroll input builder converts existing employee attendance and salary inputs into variable contexts and adds evaluated values to existing adjustment buckets. React provides a structured modal instead of free-form source code.

**Tech Stack:** TypeScript, Mongoose, Express, React 19, Tailwind CSS, Vitest.

## Global Constraints

- Never execute free-form code or use `eval`.
- Only approved system variables and operators are accepted.
- Formula results are independent and ordered by ascending priority then code.
- Existing statutory payroll policy behavior remains intact.
- Mutation routes require `payroll:manage`.

### Task 1: Safe formula domain engine

**Files:** Create `server/interface/payroll-formula.interface.ts`, `server/config/payroll-formula-variables.ts`, `server/service/payroll-formula-engine.service.ts`; test `server/service/payroll-formula-engine.service.test.ts`.

- [ ] Write failing tests for arithmetic, conditions, rounding, ordering, invalid variables, depth, missing variables, and division by zero.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement typed validation and evaluation returning bucket totals and traces.
- [ ] Run focused tests to green.

### Task 2: Persistence and manager API

**Files:** Create `server/model/payroll-formula.model.ts`, `server/service/payroll-formula-operations.service.ts`, `server/controller/payroll-formula.controller.ts`; modify `server/router/payroll.router.ts`; test `server/service/payroll-formula-operations.service.test.ts`.

- [ ] Write failing lifecycle/version tests.
- [ ] Implement tenant-scoped list/create/update/clone/activate/retire operations and routes.
- [ ] Verify lifecycle tests and typecheck.

### Task 3: Payroll calculation integration

**Files:** Modify `server/service/payroll-run-calculate-operations.service.ts`, `server/interface/payroll-revision.interface.ts`; test `server/service/payroll-run-calculate-operations.test.ts` and engine integration tests.

- [ ] Write a failing test proving active formula results enter the configured adjustment bucket with trace metadata.
- [ ] Load effective active formulas, build employee variable context, evaluate, and merge totals before statutory calculation.
- [ ] Persist formula applications on line snapshots and verify existing payroll tests remain green.

### Task 4: No-code library UI

**Files:** Create `src/components/hr/payroll/PayrollFormulaLibrary.tsx`, `src/components/hr/payroll/PayrollFormulaModal.tsx`, `src/components/hr/payroll/payrollFormulaForm.ts`; modify `src/components/hr/PayrollTab.tsx`, `src/services/payrollService.ts`; test form serialization and component rendering.

- [ ] Write failing tests for structured controls, active highlight, serialization, and manager actions.
- [ ] Implement list cards and a guided modal for metadata, flat conditions, expression rows, rounding, priority, and preview.
- [ ] Connect API refresh and selected-period recalculation behavior.
- [ ] Run UI tests, affected payroll tests, typecheck, and `git diff --check`.
