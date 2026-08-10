# Retail Phase 2 Operational UI Design

## 1. Goal

Deliver a complete, production-oriented retail counter workflow on top of the phase-1 transaction APIs: cashier shifts, responsive POS checkout, held drafts, order management, debt collection, cancellation/refund, and internal invoice viewing.

This document extends `docs/dac-ta-model-retail.md`, `docs/dac-ta-api-fe-retail.md`, and `docs/superpowers/specs/2026-08-10-retail-phase-1-design.md`. The approved phase-1 decisions remain authoritative where the source documents differ.

## 2. Scope

### Included

- Responsive and touch-friendly POS for desktop, tablets, and phones.
- Product lookup by name, SKU, or barcode.
- USB/Bluetooth keyboard-wedge barcode scanners and phone-camera scanning.
- A server-authoritative cart, quote, split-payment, debt-sale, and checkout flow.
- Up to five held draft orders per cashier per branch.
- Held-order ownership, manager override, and business-date expiry.
- Cashier shift opening, cash movements, blind close/count, and manager reconciliation.
- Order search, filters, detail, later debt collection, cancellation, and explicit refunds.
- Internal invoice list and immutable detail view.
- Retail workspace navigation for Sales, Orders, Shifts, Invoices, Customers, and Settings.

### Deferred

- PDF, browser, A4, ESC/POS, or hardware-printer output.
- Item-level sales returns and exchanges.
- IMEI and serial-number inventory control.
- Commissions, customer tiers, advanced analytics, and realtime dashboards.
- Legal electronic invoice integrations.

## 3. Authorization and ownership

Phase 2 continues to use only `retail:operate` and `retail:manager`.

- Operators can run normal counter operations, manage their own held drafts, close their own shift, collect debt, and cancel draft or non-completed orders under the phase-1 rules.
- Managers inherit operator capabilities, can open or edit another cashier's held draft in the same company and branch, view cost/profit fields, approve shift reconciliation, and cancel completed orders with an explicit refund distribution.
- Backend authorization remains authoritative. Frontend checks only hide or disable unavailable actions.
- Normal users derive company and allowed branch scope from their authenticated actor. Superadmin calls require explicit scope under the phase-1 contract.

## 4. Retail workspace and navigation

Add these subtabs to the Retail workspace:

1. `Bán hàng`
2. `Đơn hàng`
3. `Ca bán hàng`
4. `Hóa đơn`
5. `Khách hàng`
6. `Cài đặt`

Sales is the default operational subtab when the actor can operate Retail. Existing Customers and Settings behavior stays unchanged. Deep links preserve the selected subtab and relevant record identifier where the existing router pattern supports it.

## 5. POS experience

### 5.1 Layout

Desktop uses a two-pane layout: product discovery on the left and cart/payment on the right. Mobile and narrow tablets use a three-step flow: Products, Cart, and Payment, with the current item count and total fixed at the bottom.

The POS header always shows company branch, cashier, current shift, and fixed shift business date. Checkout actions are unavailable without an open shift, while held drafts may be viewed according to ownership rules.

### 5.2 Product discovery and scanning

Products are searched only within the exact company and branch. Search supports debounced name/SKU lookup and exact barcode lookup with pagination or incremental loading.

Keyboard-wedge scanners feed a focused scanner buffer and submit on Enter. Camera scanning starts only after an explicit user action and permission grant. A manual search/input path is always available. Repeated scans increase the existing cart line quantity.

Unknown barcodes, products from another branch, and unavailable products produce a stable, user-readable error without mutating the cart.

### 5.3 Cart and pricing

The cart supports quantity changes, line removal, line discount, order discount, tax rate, shipping fee, customer selection, and due date. Cashiers cannot override authoritative product unit price.

The frontend may calculate optimistic display values for responsiveness, but every material cart change is reconciled through the phase-1 quote endpoint. Only server totals may be submitted for confirmation. If price, discount policy, or inventory changes, the POS replaces its quote and requires the cashier to review before checkout.

### 5.4 Payment

Checkout supports split payments across cash, card, transfer, and e-wallet. Debt is never represented as a payment method. A positive due amount requires a customer and due date.

Cash records applied amount, tendered amount, and computed change. Non-cash methods accept an optional transaction reference and cannot contain tender/change. Applied payments cannot exceed the order total.

The checkout attempt has one client-generated idempotency key. Disabling the submit button is a presentation safeguard, not the correctness mechanism. On timeout or lost connectivity, the client queries the attempt/order state before allowing a retry with a new key.

## 6. Held drafts

A held order remains a phase-1 `draft`; it never reserves or decrements stock.

- Limit: five active held drafts per `{ companyCode, branchId, cashierId }`.
- Ownership: only its creator and a Retail manager can open or edit it.
- Visibility: operators see their drafts; managers can search and open branch drafts.
- Lifetime: a held draft expires when its `businessDate` is no longer the current business date for the branch.
- Expiry result: the server changes it to `cancelled` with the system reason `Đơn treo hết hạn`; no stock or payment writes occur.
- Limit enforcement and expiry are server-side and race-safe. The UI count is informative only.

Expiry is applied lazily before held-draft list/create/update operations and by a scheduled cleanup hook if the repository already has an appropriate scheduler. Correctness must not depend on the scheduler running.

## 7. Cashier shifts

### 7.1 Open and in-shift operations

Opening a shift requires opening float and accepts an optional terminal ID. Existing phase-1 cashier and terminal uniqueness indexes remain authoritative.

The current-shift view shows opening information and recorded cash movements. Cash in/out requires a positive integer-VND amount and non-empty reason. Orders, later collections, and refunds inherit the open shift ID and its fixed business date.

### 7.2 Blind close and reconciliation

The cashier submits counted cash before receiving expected cash, revenue, or method-derived hints. After submission, the close result shows gross sales, collected amount, new debt, refunds, net collected, payment method totals, expected cash, counted cash, and variance.

Any absolute variance greater than the branch setting threshold requires a reason. With the default threshold of zero, every non-zero variance requires a reason. Managers approve/reconcile closed shifts; approval records immutable actor/time snapshots.

## 8. Order management

Order list supports pagination and search by order code, customer name, and customer phone. Filters include branch, business-date range, order status, and payment status. Scope and cost stripping are applied by the backend.

Order detail shows item snapshots, monetary totals, customer, creator/salesperson, status history available from stored timestamps, payment/refund transactions, stock references, and linked invoice. Managers additionally see cost and profit.

Confirmed orders with debt can receive later split payments through the phase-1 collection flow. The UI requires an open shift and refreshes the authoritative remaining amount immediately before submission.

Cancellation behavior remains as approved in phase 1:

- Draft cancellation has no stock effect.
- Operators may cancel non-completed orders under the existing rule.
- Completed-order cancellation requires a manager.
- Confirmed/completed cancellation requires a reason.
- Collected money requires an explicit refund distribution.
- Refunds are separate immutable transactions and require a current open shift.
- Stock reversal, invoice voiding, refund records, and order state change are transactional.

Item-level return or exchange is not simulated through cancellation and stays deferred to Phase 3.

## 9. Internal invoices

Invoice list supports pagination and filtering by invoice number, order code, customer, issue date, branch, and status. Detail renders only the immutable invoice snapshot and audit metadata.

Invoice payloads never expose unit cost. A cancelled order's invoice becomes void but remains queryable. Phase 2 contains no print button, print CSS, PDF generation, ESC/POS output, or printer integration.

## 10. Backend additions

Phase-1 services remain the transaction core. Phase 2 adds only contracts required by the operational UI:

- Exact-branch POS product search and exact barcode resolution.
- Held-draft metadata, count/list filters, five-draft enforcement, ownership checks, and expiry.
- Order list filters and UI-oriented detail projection.
- Invoice list filters and detail projection.
- Idempotency-attempt status lookup if the existing confirm response cannot resolve a timed-out attempt safely.
- Stable response DTOs for shift summaries and manager reconciliation.

Controllers remain thin. Pricing and monetary arithmetic stay in services. Every persistence query includes company scope and exact branch scope for branch-owned records.

## 11. Concurrency, offline ambiguity, and errors

Draft updates use the stored `version`. A stale update returns a conflict and the latest safe representation rather than overwriting another screen.

Stable business errors cover at least:

- no open shift;
- five held drafts already active;
- held draft expired;
- held draft owned by another cashier;
- stale order version;
- unknown or wrong-branch product/barcode;
- insufficient stock;
- authoritative total changed;
- payment exceeds remaining due;
- invalid tender/change; and
- idempotency key conflict or indeterminate checkout lookup.

The POS never reports a timed-out checkout as failed until it has checked the server using the same attempt identity. It never stores sensitive card data; only method and transaction reference are retained.

## 12. Frontend component boundaries

Use focused feature units rather than a single POS component:

- Workspace route/tab configuration.
- Current-shift query and guard.
- POS product search/scanner adapter.
- Cart reducer and server-quote synchronization.
- Held-draft query/actions.
- Payment composer and checkout mutation.
- Shift open/movement/close/reconcile views.
- Order list/detail/action dialogs.
- Invoice list/detail views.

Shared API envelope/error handling continues through `src/modules/shared/lib/apiFetch.ts`. Query cache keys always include company/branch identity and filters. Camera code is lazy-loaded only when scanning is requested.

## 13. Verification strategy

Backend tests cover:

- exact-branch product/barcode lookup and tenant isolation;
- five-draft enforcement under parallel creation;
- creator ownership and manager override;
- business-date expiry and cancellation reason;
- version conflicts;
- idempotency lookup after ambiguous checkout;
- order/invoice filtering and cost stripping;
- shift summaries and blind-count visibility; and
- existing phase-1 transaction and concurrency invariants.

Frontend tests cover:

- desktop and mobile POS navigation;
- keyboard scanner and camera adapter behavior;
- repeated scans and cart mutations;
- quote refresh and changed-total confirmation;
- split payments, cash tender/change, and debt validation;
- held-draft limit/ownership/expiry presentation;
- shift open, cash movement, blind close, and manager approval;
- order filters/detail/collection/cancellation/refund; and
- invoice list/detail with no cost or print action.

Final verification runs the complete Retail backend and frontend suites, full TypeScript typecheck, production build, route/permission tests, and mechanical scans for obsolete Retail permission codes and unscoped persistence queries.

## 14. Delivery sequence

1. Backend operational contracts: product lookup, held-draft rules, list projections, and stable errors.
2. Retail workspace routing and current-shift state.
3. Shift operation and reconciliation UI.
4. Responsive POS product discovery, scanning, and cart/quote state.
5. Held drafts and ownership/expiry UI.
6. Checkout, split payment, debt, and idempotency recovery.
7. Order list/detail, later collection, cancellation, and refund UI.
8. Invoice list/detail UI.
9. Cross-cutting responsive, accessibility, isolation, concurrency, typecheck, and build verification.

