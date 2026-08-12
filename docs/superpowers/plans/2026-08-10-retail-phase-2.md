# Retail Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete responsive Retail counter workflow for shifts, POS checkout, held drafts, order operations, and internal invoice viewing.

**Architecture:** Extend the existing phase-1 Retail services with small operational query/ownership contracts while keeping pricing, stock, payment, and invoice writes server-authoritative. Build focused React API modules, hooks, and pages inside `src/modules/retail`, with the Retail workspace serving as the lazy-loaded navigation shell.

**Tech Stack:** TypeScript, Express, Mongoose transactions, React 19, Tailwind CSS, Vitest, Node test runner.

## Global Constraints

- Keep only `retail:operate` and `retail:manager` permissions.
- Scope every backend query by company; scope branch-owned records by exact branch.
- Held drafts do not reserve stock and are limited to five per cashier/branch/business date.
- Server quote and transaction services remain authoritative for all money and stock.
- No printing, returns/exchanges, or serial/IMEI work in Phase 2.
- Implement with TDD and do not modify the user's pre-existing deleted documentation file.

---

### Task 1: Held draft lifecycle and product lookup

**Files:**
- Modify: `server/modules/retail/interfaces/retail-order.interface.ts`
- Modify: `server/modules/retail/models/retail-order.model.ts`
- Create: `server/modules/retail/services/retail-product.service.ts`
- Create: `server/modules/retail/services/retail-product.service.test.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/services/retail-order.service.test.ts`
- Modify: `server/modules/retail/controllers/retail-order.controller.ts`
- Modify: `server/modules/retail/routes/retail-order.routes.ts`

**Interfaces:**
- Produces: `RetailProductService.search(scope, query)` and ownership-aware draft list/create/update/cancel behavior.
- Produces: draft fields `businessDate`, `heldAt`, `expiresAt`, `expiredBySystem` and stable errors `HELD_DRAFT_LIMIT`, `HELD_DRAFT_FORBIDDEN`, `HELD_DRAFT_EXPIRED`, `ORDER_VERSION_CONFLICT`.

- [ ] Write failing tests for exact-branch name/SKU/barcode lookup, five active drafts, owner/manager access, lazy expiry, and version conflict.
- [ ] Run the focused tests and verify the new cases fail.
- [ ] Add the minimal model indexes and service helpers; enforce the limit with a transaction-safe counter query and recheck on duplicate/race paths.
- [ ] Add `GET /retail/orders/products` and held-draft query parameters without shadowing `/:id`.
- [ ] Run focused tests and verify all cases pass.

### Task 2: Operational order and invoice projections

**Files:**
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/controllers/retail-order.controller.ts`
- Modify: `server/modules/retail/services/retail-invoice.service.ts`
- Create: `server/modules/retail/services/retail-invoice.service.test.ts`
- Modify: `server/modules/retail/controllers/retail-invoice.controller.ts`

**Interfaces:**
- Produces: order filters `q`, `from`, `to`, `status`, `paymentStatus`, `customerId`, `shiftId`, `heldOnly`.
- Produces: invoice filters `q`, `from`, `to`, `status`, pagination; invoice responses never contain cost.
- Produces: `GET /retail/orders/idempotency/:key` for ambiguous checkout recovery.

- [ ] Write failing tests for search/date filters, manager cost projection, invoice filters, invoice cost stripping, and idempotency lookup.
- [ ] Run tests to verify failure.
- [ ] Implement escaped search, validated date ranges, scoped projections, and attempt lookup.
- [ ] Run focused backend tests to verify success.

### Task 3: Frontend contracts and workspace navigation

**Files:**
- Modify: `src/modules/retail/types.ts`
- Create: `src/modules/retail/api/retailOrders.api.ts`
- Create: `src/modules/retail/api/retailProducts.api.ts`
- Create: `src/modules/retail/api/retailShifts.api.ts`
- Create: `src/modules/retail/api/retailInvoices.api.ts`
- Modify: `src/modules/retail/RetailWorkspace.tsx`
- Modify: `src/modules/retail/retailTabPermissions.ts`
- Modify: `src/modules/retail/retailTabPermissions.test.ts`

**Interfaces:**
- Produces typed DTOs for products, quotes, carts, payments, orders, shifts, and invoices.
- Produces six workspace slugs: `ban-hang`, `don-hang`, `ca-ban-hang`, `hoa-don`, `khach-hang`, `cai-dat`.

- [ ] Write failing tests for operator and manager tab visibility/default tab.
- [ ] Run the test and verify failure.
- [ ] Add focused API modules using `apiFetch` and lazy workspace pages.
- [ ] Run tests and typecheck.

### Task 4: Shift operations UI

**Files:**
- Create: `src/modules/retail/pages/RetailShiftsPage.tsx`
- Create: `src/modules/retail/pages/RetailShiftsPage.test.tsx`
- Create: `src/modules/retail/components/shifts/OpenShiftDialog.tsx`
- Create: `src/modules/retail/components/shifts/CashMovementDialog.tsx`
- Create: `src/modules/retail/components/shifts/CloseShiftDialog.tsx`
- Create: `src/modules/retail/hooks/useRetailShift.ts`

**Interfaces:**
- Produces: `useRetailShift(scope)` with current/open/movement/close/approve operations and refresh.
- Consumes: existing phase-1 shift endpoints and manager capability.

- [ ] Write failing interaction tests for opening, cash movement, blind count, threshold reason, and manager approval.
- [ ] Run tests and verify failure.
- [ ] Implement responsive dialogs/page without exposing expected cash before count submission.
- [ ] Run focused tests and typecheck.

### Task 5: POS cart, scanning, and quote synchronization

**Files:**
- Create: `src/modules/retail/pages/RetailPosPage.tsx`
- Create: `src/modules/retail/pages/RetailPosPage.test.tsx`
- Create: `src/modules/retail/components/pos/ProductSearchPanel.tsx`
- Create: `src/modules/retail/components/pos/CartPanel.tsx`
- Create: `src/modules/retail/components/pos/MobilePosSteps.tsx`
- Create: `src/modules/retail/hooks/useRetailCart.ts`
- Create: `src/modules/retail/hooks/useBarcodeScanner.ts`

**Interfaces:**
- Produces: cart reducer actions `add`, `setQuantity`, `remove`, `setDiscount`, `setCustomer`, `replaceQuote`, `reset`.
- Produces: keyboard scanner buffer and lazy camera adapter with manual fallback.

- [ ] Write failing reducer/UI tests for repeated scan, quantity/removal, desktop/mobile navigation, and quote replacement.
- [ ] Run tests and verify failure.
- [ ] Implement reducer, debounced lookup, keyboard scanner, camera permission boundary, and server quote synchronization.
- [ ] Run focused tests and typecheck.

### Task 6: Held drafts and checkout

**Files:**
- Create: `src/modules/retail/components/pos/HeldDraftsPanel.tsx`
- Create: `src/modules/retail/components/pos/PaymentDialog.tsx`
- Create: `src/modules/retail/components/pos/HeldDraftsPanel.test.tsx`
- Create: `src/modules/retail/components/pos/PaymentDialog.test.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/hooks/useRetailCart.ts`

**Interfaces:**
- Consumes: draft create/update/list, quote, confirm, and idempotency lookup APIs.
- Produces: split payments with `amount`, optional cash `tenderedAmount`, optional non-cash `reference`, and debt validation.

- [ ] Write failing tests for five-draft UI, ownership errors, expiry refresh, split payment, change, debt requirements, double-submit, and timeout recovery.
- [ ] Run tests and verify failure.
- [ ] Implement held-draft actions and idempotent checkout state machine.
- [ ] Run focused tests and typecheck.

### Task 7: Order management UI

**Files:**
- Create: `src/modules/retail/pages/RetailOrdersPage.tsx`
- Create: `src/modules/retail/pages/RetailOrdersPage.test.tsx`
- Create: `src/modules/retail/components/orders/OrderDetailDialog.tsx`
- Create: `src/modules/retail/components/orders/CollectPaymentDialog.tsx`
- Create: `src/modules/retail/components/orders/CancelOrderDialog.tsx`

**Interfaces:**
- Consumes: order pagination/filter/detail, collect, cancel/refund APIs.
- Produces: manager-only cost/profit presentation and ownership-aware draft continuation link.

- [ ] Write failing tests for filters, details, debt collection, cancellation/refund distribution, and cost visibility.
- [ ] Run tests and verify failure.
- [ ] Implement responsive list/cards, dialogs, and authoritative refresh after every mutation.
- [ ] Run focused tests and typecheck.

### Task 8: Invoice management UI

**Files:**
- Create: `src/modules/retail/pages/RetailInvoicesPage.tsx`
- Create: `src/modules/retail/pages/RetailInvoicesPage.test.tsx`
- Create: `src/modules/retail/components/invoices/InvoiceDetailDialog.tsx`

**Interfaces:**
- Consumes: invoice list/detail API.
- Produces: immutable issued/void invoice display with no cost and no print action.

- [ ] Write failing list/detail tests asserting absence of cost and print controls.
- [ ] Run tests and verify failure.
- [ ] Implement responsive list and snapshot detail.
- [ ] Run focused tests and typecheck.

### Task 9: Cross-cutting verification

**Files:**
- Modify only Phase-2 files when failures reveal a real defect.

- [ ] Run all `server/modules/retail` tests plus module/route permission tests.
- [ ] Run all `src/modules/retail` and shared API tests.
- [ ] Run `npm run typecheck` and require exit code 0.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Run `git diff --check` and inspect every Retail persistence query for company/branch scope.
- [ ] Verify the user's unrelated deleted documentation file is unchanged.

