# Vietnam Payroll Operations 2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish immutable payslips, provide employee self-service, and export detailed payroll, insurance, PIT, and bank-transfer workbooks while preserving legacy CSV.

**Architecture:** Render payslips and exports exclusively from the closed active revision and its snapshots. Publication controls visibility without copying or changing payroll values; export jobs record filters, actor, checksum, and output metadata.

**Tech Stack:** TypeScript, Express, Mongoose, React, Vitest, existing PDF and spreadsheet libraries in the repository.

## Global Constraints

- Requires phases 2A–2D.
- Employee self-service returns only the authenticated employee's published payslips.
- Exported monetary data must equal closed snapshot values exactly.
- Bank exports require `payroll:pay`; other exports require `payroll:read` with field-level redaction.
- Existing CSV endpoints remain unchanged and are covered by regression tests.

---

### Task 1: Define payslip view models and publication records

**Files:**
- Create: `server/interface/payroll-payslip.interface.ts`
- Create: `server/model/payslip-publication.model.ts`
- Create: `server/service/payroll-payslip.service.ts`
- Test: `server/service/payroll-payslip.service.test.ts`

**Interfaces:**
- Produces: `buildPayslip(run, line, payments): PayrollPayslipView` and publication queries.

- [ ] Write failing tests for closed snapshot rendering, draft HR preview, unpublished employee denial, published self-read, withdrawal, and cross-employee denial.
- [ ] Run focused test; expect missing module.
- [ ] Implement pure view construction and publication records keyed by `{ runId, employeeId }`; do not query current contract/bank/profile values.
- [ ] Run test and commit with `feat: build immutable payroll payslips`.

### Task 2: Add publication, preview, self-service, and PDF APIs

**Files:**
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Create: `server/service/payroll-payslip-pdf.service.ts`
- Test: `server/router/payroll-payslip.router.test.ts`

**Interfaces:**
- Produces: publish/unpublish, HR preview, employee list/detail, and PDF download endpoints.

- [ ] Write failing route tests for all permission, scope, publication, content type, checksum, and audit cases.
- [ ] Run test; expect missing routes.
- [ ] Implement endpoints under `/runs/:id/payslips`, `/employee/me/payslips`, and PDF response streaming using the repository's existing PDF dependency.
- [ ] Run test and commit with `feat: expose payroll payslip api`.

### Task 3: Build auditable Excel export jobs

**Files:**
- Create: `server/interface/payroll-export.interface.ts`
- Create: `server/model/payroll-export-job.model.ts`
- Create: `server/service/payroll-export.service.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/service/payroll-export.service.test.ts`
- Test: `server/router/payroll-export.router.test.ts`

**Interfaces:**
- Produces: export types `detailed | insurance | pit | bank_transfer`, job creation, status, and download.

- [ ] Write failing tests that parse each workbook and compare exact rows/totals with fixture snapshots; test bank permission, job retry, checksum, audit metadata, and legacy CSV regression.
- [ ] Run both focused tests; expect failures.
- [ ] Implement workbook builders as separate pure functions, persist export job metadata, and expose create/status/download routes.
- [ ] Run export and legacy CSV tests; expect PASS.
- [ ] Commit with `feat: export payroll operation workbooks`.

### Task 4: Build payslip and export UI

**Files:**
- Create: `src/components/hr/payroll/PayrollPayslipsPanel.tsx`
- Create: `src/components/hr/payroll/PayrollExportsPanel.tsx`
- Create: `src/components/hr/EmployeePayslips.tsx`
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/PayrollTab.tsx`
- Test: `src/components/hr/payroll/PayrollPayslipsPanel.test.tsx`
- Test: `src/components/hr/payroll/PayrollExportsPanel.test.tsx`

**Interfaces:**
- Consumes: payslip, publication, export-job, and download APIs.

- [ ] Write failing UI tests for bulk publish, withdrawal, employee self-view, PDF download, export progress, bank permission, and failed-job retry.
- [ ] Run tests; expect missing components.
- [ ] Implement panels, self-service route integration, polling, accessible progress states, and download handling.
- [ ] Run UI tests, all payroll suites, `npm run typecheck`, and `npm run build`.
- [ ] Run `git diff --check` and verify only planned payroll/docs files changed.
- [ ] Commit with `feat: complete payroll payslip and export operations`.

### Task 5: End-to-end acceptance and compatibility handoff

**Files:**
- Create: `server/service/payroll-operations.acceptance.test.ts`
- Modify: `docs/superpowers/plans/2026-07-30-vietnam-payroll-operations-2a.md`
- Modify: `docs/superpowers/plans/2026-07-30-vietnam-payroll-operations-2b.md`
- Modify: `docs/superpowers/plans/2026-07-30-vietnam-payroll-operations-2c.md`
- Modify: `docs/superpowers/plans/2026-07-30-vietnam-payroll-operations-2d.md`
- Modify: `docs/superpowers/plans/2026-07-30-vietnam-payroll-operations-2e.md`

**Interfaces:**
- Verifies the public behavior delivered by all five plans.

- [ ] Write an acceptance test covering create, sync, lock, calculate, adjust, recalculate, review, reject, approve, close, partial payment, reversal, full payment, publication, employee view, and four exports.
- [ ] Add regression assertions that legacy run reads and CSV export remain byte-compatible for a fixed fixture.
- [ ] Run `npx vitest run server/service/payroll-operations.acceptance.test.ts`; fix only implementation defects, never weaken assertions.
- [ ] Run all payroll tests, typecheck, production build, and `git diff --check`; require zero failures.
- [ ] Mark only actually completed checklist items and commit with `test: verify payroll operations workflow`.
