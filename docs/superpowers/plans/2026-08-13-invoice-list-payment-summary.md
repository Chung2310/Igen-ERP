# Invoice List Payment Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an immediately visible localized payment summary on each invoice list card, including paid and due amounts for partial payments.

**Architecture:** Add a pure summary helper next to the existing invoice payment-row helper, then render its output in the list card. The helper derives legacy totals from payment rows and grand total when snapshot summary fields are absent.

**Tech Stack:** TypeScript, React, Vitest, Testing Library.

## Global Constraints

- Do not mutate invoice snapshots.
- Use integer VND formatting with the existing Vietnamese money formatter.
- Partial text is exactly `Thanh toán một phần · Đã thanh toán <paidAmount> · Còn nợ <dueAmount>`.

---

### Task 1: Payment summary derivation and list rendering

**Files:**
- Modify: `src/modules/retail/components/pos/invoicePaymentDisplay.ts`
- Modify: `src/modules/retail/components/pos/invoicePaymentDisplay.test.ts`
- Modify: `src/modules/retail/pages/RetailInvoicesPageContent.tsx`
- Modify: `src/modules/retail/pages/RetailInvoicesPage.test.tsx`

**Interfaces:**
- Produces: `invoicePaymentSummary(snapshot): { label: string; paidAmount?: number; dueAmount?: number }`.

- [ ] Add failing pure-helper tests for one method, mixed methods, full debt, and partial debt with paid/due amounts.
- [ ] Add a failing page test proving the partial summary is visible before opening the invoice.
- [ ] Run `npx vitest run src/modules/retail/components/pos/invoicePaymentDisplay.test.ts src/modules/retail/pages/RetailInvoicesPage.test.tsx --reporter=dot` and confirm expected failures.
- [ ] Implement the helper and render one compact summary line in each invoice card.
- [ ] Re-run focused tests, then full invoice tests and `npx tsc --noEmit --pretty false`.
- [ ] Review, commit, and push `fix/pos-finance-outbox-worker`.
