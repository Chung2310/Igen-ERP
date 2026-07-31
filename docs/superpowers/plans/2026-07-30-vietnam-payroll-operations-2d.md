# Vietnam Payroll Operations 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support secure multi-installment payroll payments with confirmation, cancellation, reversal, evidence, idempotency, and derived run payment status.

**Architecture:** Store append-only payment allocations separately from payroll runs. Derive paid totals from confirmed, non-reversed payments inside transactions and persist denormalized totals on the run for fast reads.

**Tech Stack:** TypeScript, Express, Mongoose transactions, Joi, React, Vitest.

## Global Constraints

- Requires a `closed` run from phase 2C.
- A confirmed payment is never edited or deleted.
- Allocations cannot exceed each employee's outstanding net pay.
- `idempotencyKey` is unique per company; the same key with different payload returns HTTP 409.
- Bank and evidence fields require `payroll:pay` and branch scope.

---

### Task 1: Define payment allocation and status derivation

**Files:**
- Create: `server/interface/payroll-payment.interface.ts`
- Create: `server/service/payroll-payment-allocation.service.ts`
- Test: `server/service/payroll-payment-allocation.service.test.ts`

**Interfaces:**
- Produces: `allocatePayrollPayment(lines, requested)` and `derivePayrollPaymentStatus(netPay, confirmedPaid)`.

- [ ] Write failing tests for partial payment, exact payment, overpayment, rounding, zero-net lines, and reversal.
- [ ] Run the focused test; expect missing module.
- [ ] Implement integer-only allocation and return `closed | partially_paid | paid`.
- [ ] Run tests and commit with `feat: define payroll payment allocation`.

### Task 2: Persist append-only payments

**Files:**
- Create: `server/model/payroll-payment.model.ts`
- Test: `server/model/payroll-payment.model.test.ts`

**Interfaces:**
- Produces: `PayrollPaymentModel` with allocation lines and lifecycle metadata.

- [ ] Write failing model tests for unique company idempotency key, required evidence metadata, valid lifecycle statuses, and nonnegative integer amounts.
- [ ] Run test; expect failure.
- [ ] Implement schema and indexes `{ companyCode: 1, idempotencyKey: 1 }` unique and `{ runId: 1, status: 1 }`.
- [ ] Run test and commit with `feat: persist payroll payments`.

### Task 3: Add transactional payment APIs

**Files:**
- Create: `server/service/payroll-payment.service.ts`
- Create: `server/validation/payroll-payment.validation.ts`
- Modify: `server/controller/payroll.controller.ts`
- Modify: `server/router/payroll.router.ts`
- Test: `server/router/payroll-payment.router.test.ts`

**Interfaces:**
- Produces: create, confirm, cancel, reverse, and list payment operations.

- [ ] Write failing tests for branch scope, permission, idempotent replay, mismatched replay, overpayment race, confirmation, cancellation, reversal, audit, and derived run status.
- [ ] Run test; expect 404/missing service failures.
- [ ] Implement Joi schemas and transactional service locks using run `expectedVersion`; recompute totals from persisted confirmed payments before commit.
- [ ] Mount `/runs/:id/payments` and `/payments/:id/{confirm,cancel,reverse}` routes with `payroll:pay`.
- [ ] Run tests and commit with `feat: add payroll payment api`.

### Task 4: Build payment operations UI

**Files:**
- Create: `src/components/hr/payroll/PayrollPaymentsPanel.tsx`
- Create: `src/components/hr/payroll/PayrollPaymentDialog.tsx`
- Modify: `src/services/payrollService.ts`
- Modify: `src/components/hr/PayrollTab.tsx`
- Test: `src/components/hr/payroll/PayrollPaymentsPanel.test.tsx`

**Interfaces:**
- Consumes: payment endpoints and closed-run line balances.

- [ ] Write failing UI tests for selecting recipients, partial amount validation, confirm, reverse reason, permission masking, and idempotent retry.
- [ ] Run focused test; expect missing component.
- [ ] Implement typed service calls and UI; generate one client idempotency key per submission and reuse it on retry.
- [ ] Run tests, typecheck, build, and phase 2D API suites.
- [ ] Commit with `feat: add payroll payment ui`.
