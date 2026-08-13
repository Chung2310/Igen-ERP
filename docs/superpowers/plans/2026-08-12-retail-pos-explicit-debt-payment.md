# Retail POS Explicit Debt Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit full, partial, and full-debt modes to Retail POS checkout while preserving the existing order-confirmation API.

**Architecture:** Extend the pure payment summary function with an explicit `RetailPaymentMode`, then make `PaymentDialog` own mode selection and mode transitions. `RetailPosPage` continues to submit payments and due date through the existing draft/confirm flow.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing Retail API client.

## Global Constraints

- Debt is not a payment method.
- Full payment requires collected amount equal to order total.
- Partial payment requires collected amount greater than zero and below total, plus customer and due date.
- Full debt requires no payment rows, plus customer and due date.
- Keep the existing Retail confirmation API contract.

---

### Task 1: Mode-aware payment validation

**Files:**
- Modify: `src/modules/retail/hooks/retailPayment.ts`
- Modify: `src/modules/retail/hooks/retailPayment.test.ts`

**Interfaces:**
- Produces: `export type RetailPaymentMode = "full" | "partial" | "debt"`.
- Produces: `buildPaymentSummary(total, payments, { mode, customerId, dueDate })` returning `{ collected, due, change }`.

- [ ] **Step 1: Write failing tests**

Add cases proving `full` rejects underpayment, `partial` accepts only `0 < collected < total` with customer/due date, and `debt` accepts only an empty payment list with customer/due date. Retain tests for overpayment, cash tender and non-cash tender.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/retail/hooks/retailPayment.test.ts`

Expected: FAIL because mode-aware validation does not exist.

- [ ] **Step 3: Implement mode validation**

Add `RetailPaymentMode`, default `mode` to `full` only for backward type migration if needed, calculate collected/change as today, then apply exact mode invariants and Vietnamese error messages. For `debt`, reject any positive payment row before returning `{ collected: 0, due: total, change: 0 }`.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/modules/retail/hooks/retailPayment.test.ts`

Expected: all payment-domain tests PASS.

### Task 2: Explicit modes in PaymentDialog

**Files:**
- Modify: `src/modules/retail/components/pos/PaymentDialog.tsx`
- Create: `src/modules/retail/components/pos/PaymentDialog.test.tsx`

**Interfaces:**
- Consumes: `RetailPaymentMode` and mode-aware `buildPaymentSummary` from Task 1.
- Preserves: `onSubmit(payments: RetailPaymentInput[], dueDate?: string): Promise<void>`.

- [ ] **Step 1: Write failing component tests**

Test the default full mode, three accessible mode buttons, full-mode underpayment rejection, partial-mode debt summary and submit payload, missing customer/due-date errors, debt-mode hidden payment inputs and `onSubmit([], dueDate)`, and resetting to full cash payment when switching back to full.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/retail/components/pos/PaymentDialog.test.tsx`

Expected: FAIL because the three modes are not rendered.

- [ ] **Step 3: Implement mode UI and transitions**

Add `mode` state initialized to `full`; render an accessible three-button selector. Pass mode into summary/submit validation. Render payment rows only outside debt mode, render due date only for partial/debt, pass `[]` on debt submit, reset to one full-total cash row on selecting full, and initialize a cash row when leaving debt with no rows.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/modules/retail/hooks/retailPayment.test.ts src/modules/retail/components/pos/PaymentDialog.test.tsx`

Expected: all domain and dialog tests PASS.

### Task 3: POS integration and verification

**Files:**
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.test.tsx`

**Interfaces:**
- Consumes: existing `PaymentDialog.onSubmit` payload.
- Produces: draft includes due date and confirm receives an empty payment list for full debt.

- [ ] **Step 1: Write failing POS integration test**

Update the PaymentDialog mock to expose a full-debt action that invokes `onSubmit([], "2026-09-30")`; assert `createDraft` receives `customerId` and `dueDate`, and `confirm` receives `payments: []`.

- [ ] **Step 2: Verify RED or existing compatibility**

Run: `npx vitest run src/modules/retail/pages/RetailPosPage.test.tsx`

Expected: either FAIL showing missing integration or PASS proving the existing checkout contract already supports it; record the result and change production code only if the test identifies a gap.

- [ ] **Step 3: Update POS mode validation call**

Remove or adapt the redundant `RetailPosPage.checkout` call to `buildPaymentSummary`, because the page does not receive the selected mode. Rely on the validated dialog payload while preserving draft and confirm error handling.

- [ ] **Step 4: Run full verification**

Run focused tests for `retailPayment`, `PaymentDialog`, and `RetailPosPage`, then `npm run typecheck` and `npm run build`. Expected: zero failures and exit code 0.

- [ ] **Step 5: Review and commit**

Run `git diff --check`, inspect only scoped Retail changes, and commit with `feat: add explicit retail debt payment modes`.
