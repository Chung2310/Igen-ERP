# Payroll Period Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audited, versioned employee input overrides per payroll period and expose active custom variables to payroll formulas.

**Architecture:** Separate custom-variable definitions from employee-period values. A resolver preserves explicit zero and returns effective values plus provenance. Manager APIs enforce draft-period locking and optimistic versions. Both payroll calculation paths consume resolved overrides before formula evaluation; React presents a centralized reconciliation table.

**Tech Stack:** TypeScript, Mongoose, Express, React 19, Tailwind CSS, Vitest.

## Constraints

- Writes require `payroll:manage`, a reason, and an editable no-run/draft period.
- Overrides never mutate contracts or attendance records.
- Saving marks payroll as needing refresh but never recalculates automatically.
- Explicit zero differs from an absent override.

### Task 1: Override domain and persistence

Create period-input/custom-variable interfaces and models, a pure precedence resolver, and TDD coverage for zero/absence, validation, provenance, and namespace behavior.

### Task 2: Manager lifecycle and APIs

Create tenant/branch-scoped operations and controllers for row/bulk input saving and custom-variable lifecycle. Add routes with read/manage permissions, run-state locking, version checks, audit writes, and partial bulk results.

### Task 3: Payroll calculation integration

Load period inputs and active variables in both calculation paths. Apply salary/day/hour/adjustment overrides, add custom values to formula contexts, and persist input provenance/version on payroll lines.

### Task 4: Reconciliation UI

Add service calls and a searchable inline table showing source/effective values, active custom columns, reason entry, row/bulk save, clear override, locked state, and refresh-needed label.

### Task 5: Verification

Run focused engine/service/controller/UI regression tests, `yarn typecheck`, and `git diff --check`; inspect spec coverage before commit.
