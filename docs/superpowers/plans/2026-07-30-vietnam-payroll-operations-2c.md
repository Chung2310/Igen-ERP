# Vietnam Payroll Operations 2C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add review, approval, rejection, closing, checksum protection, separation of duties, and complete audit history.

**Architecture:** Centralize transitions in one transactional workflow service. Every transition validates state, issues, version, actor, and checksum before writing run metadata and an audit event in the same transaction.

**Tech Stack:** TypeScript, Express, Mongoose transactions, Node crypto, React, Vitest.

## Global Constraints

- Requires phases 2A and 2B.
- Closed runs, revisions, line snapshots, and attendance snapshots are immutable.
- The creator cannot approve when separation of duties is enabled.
- Rejecting approval returns a run to `calculated` and requires a reason.
- Checksum input uses canonical deterministic JSON, never raw object key order.

---

### Task 1: Implement canonical checksums and closing guards

**Files:**
- Create: `server/service/payroll-checksum.service.ts`
- Test: `server/service/payroll-checksum.service.test.ts`

**Interfaces:**
- Produces: `canonicalizePayrollSnapshot(value): string` and `calculatePayrollChecksum(value): string`.

- [ ] Write failing tests showing equal semantic objects with different key order yield the same SHA-256 checksum and one changed amount yields a different checksum.
- [ ] Run `npx vitest run server/service/payroll-checksum.service.test.ts`; expect missing module.
- [ ] Implement recursive key sorting, stable array ordering only where domain IDs define order, ISO date serialization, and SHA-256 hashing.
- [ ] Run tests and commit with `feat: add payroll snapshot checksums`.

### Task 2: Centralize review, approval, rejection, and close transitions

**Files:**
- Create: `server/service/payroll-approval-workflow.service.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/service/payroll-approval-workflow.service.test.ts`
- Test: `server/router/payroll-approval.router.test.ts`

**Interfaces:**
- Produces: `reviewRun`, `approveRun`, `rejectRun`, and `closeRun` transactional methods.

- [ ] Write failing tests for blocking issues, pending adjustments, stale calculation, separation of duties, required rejection reason, version conflict, and checksum mismatch.
- [ ] Run focused tests; expect failures.
- [ ] Implement transitions and atomically append audit entries containing actor, from/to status, reason, correlation ID, and before/after summaries.
- [ ] Replace legacy approve/close controller bodies with adapters calling the workflow service; add review and reject endpoints.
- [ ] Run tests; expect PASS.
- [ ] Commit with `feat: enforce payroll approval workflow`.

### Task 3: Harden immutability and audit access

**Files:**
- Modify: `server/model/payroll-run.model.ts`
- Modify: `server/model/payroll-audit.model.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/router/payroll-immutability.router.test.ts`

**Interfaces:**
- Produces: immutable mutation guards and paginated audit reads.

- [ ] Write failing tests attempting every money-changing endpoint against a closed run and cross-branch audit access.
- [ ] Run the focused test; expect at least one mutation to succeed incorrectly.
- [ ] Add shared `assertRunMutable` usage to adjustment, calculation, snapshot, and legacy reset paths; paginate audit by stable `(createdAt, _id)` cursor.
- [ ] Run test and commit with `fix: enforce closed payroll immutability`.

### Task 4: Build review, approval, and close UI

**Files:**
- Create: `src/components/hr/payroll/PayrollApprovalPanel.tsx`
- Create: `src/components/hr/payroll/PayrollCloseDialog.tsx`
- Create: `src/components/hr/payroll/PayrollAuditTimeline.tsx`
- Modify: `src/components/hr/payroll/PayrollRunWizard.tsx`
- Modify: `src/services/payrollService.ts`
- Test: `src/components/hr/payroll/PayrollApprovalPanel.test.tsx`

**Interfaces:**
- Consumes: workflow endpoints, permission flags, issue summary, and audit cursor.

- [ ] Write failing UI tests for permission-gated actions, required rejection reason, stale-version reload prompt, and close confirmation summary.
- [ ] Run the focused test; expect missing component failure.
- [ ] Implement panels and service methods; never optimistically display a transition before the server response.
- [ ] Run UI tests, typecheck, build, and all phase 2Aâ€“2C suites.
- [ ] Commit with `feat: add payroll approval and closing ui`.
