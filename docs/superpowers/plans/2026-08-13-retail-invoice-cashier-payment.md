# Retail Invoice Cashier and Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a human cashier name and complete localized payment/debt information on every retail invoice representation.

**Architecture:** Enrich the authenticated actor from the user record, persist payment totals in the immutable invoice snapshot, and centralize payment display derivation in a frontend helper used by dialog and print. Project legacy invoice cashier names at read time without mutating stored snapshots; PDF applies the same payment/debt rules server-side.

**Tech Stack:** TypeScript, Express, Mongoose, React, Vitest, Node test runner, PDFKit.

## Global Constraints

- Existing invoice documents remain immutable and require no backfill.
- Legacy invoice fields stay optional and derive safe display values.
- All monetary values are integer VND.
- Implement with failing tests first.

---

### Task 1: Authenticated cashier identity

**Files:**
- Modify: `server/middleware/auth.ts`
- Test: `server/middleware/auth.single-session.test.ts`

**Interfaces:**
- Produces: `req.user.displayName?: string` populated from `UserModel.displayName`.

- [ ] Add a test whose user query returns `displayName: "Nguyễn An"` and assert `req.user.displayName`.
- [ ] Run `npx tsx --test server/middleware/auth.single-session.test.ts` and confirm the new assertion fails.
- [ ] Select `displayName` with session fields, extend `AuthenticatedRequest.user`, and assign the persisted name.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Immutable invoice payment snapshot and legacy cashier projection

**Files:**
- Modify: `server/modules/retail/interfaces/retail-invoice.interface.ts`
- Modify: `server/modules/retail/models/retail-invoice.model.ts`
- Modify: `server/modules/retail/services/retail-invoice.service.ts`
- Test: `server/modules/retail/services/retail-invoice.service.test.ts`
- Test: `server/modules/retail/models/retail-models.test.ts`

**Interfaces:**
- Produces snapshot fields `paidAmount?: number`, `dueAmount?: number`, `paymentStatus?: RetailPaymentStatus`.
- Produces `projectLegacyInvoiceCashier(invoice, displayName?)` returning a response copy with a resolved cashier name only when the stored value is email-like.

- [ ] Add failing snapshot/model/projection tests covering a partial payment and email-like legacy cashier.
- [ ] Run the two focused Node test files and confirm the new assertions fail.
- [ ] Persist the new fields, prefer `actor.displayName`, and resolve legacy names in list/detail using batched user lookup.
- [ ] Re-run both focused test files and confirm they pass.

### Task 3: Shared browser payment presentation

**Files:**
- Create: `src/modules/retail/components/pos/invoicePaymentDisplay.ts`
- Create: `src/modules/retail/components/pos/invoicePaymentDisplay.test.ts`
- Modify: `src/modules/retail/types.ts`
- Modify: `src/modules/retail/components/pos/ReceiptPrintView.tsx`
- Modify: `src/modules/retail/components/pos/ReceiptPrintView.test.tsx`
- Modify: `src/modules/retail/pages/RetailInvoicesPageContent.tsx`
- Modify: `src/modules/retail/pages/RetailInvoicesPage.test.tsx`

**Interfaces:**
- Produces: `invoicePaymentRows(snapshot): Array<{ label: string; amount: number }>`.

- [ ] Add failing helper/UI tests for transfer, partial debt, and full debt.
- [ ] Run the focused Vitest files and confirm failures are caused by missing display rows.
- [ ] Implement localized rows and render them in detail dialog and receipt print view.
- [ ] Re-run focused Vitest files and confirm they pass.

### Task 4: PDF payment presentation

**Files:**
- Modify: `server/modules/retail/services/retail-invoice-pdf.service.ts`
- Test: `server/modules/retail/services/retail-invoice.service.test.ts`

**Interfaces:**
- Consumes snapshot payment fields and legacy-derived totals.

- [ ] Instrument the PDF test with a text-capturing PDFDocument mock or exported pure row helper and assert localized partial/full debt rows.
- [ ] Run the focused test and confirm failure.
- [ ] Render payment method rows, remaining debt, or full debt below totals.
- [ ] Re-run the focused test and confirm pass.

### Task 5: Full verification and delivery

**Files:**
- Verify all modified files.

- [ ] Run focused backend and frontend suites.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `git diff --check` and review the complete diff.
- [ ] Request code review and address all Important/Critical findings.
- [ ] Commit implementation and push `fix/pos-finance-outbox-worker`.
