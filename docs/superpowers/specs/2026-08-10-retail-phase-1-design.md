# Retail phase 1 design

## 1. Goal

Deliver the first usable foundation of the retail module as independently testable vertical slices. Phase 1 covers module registration, branch settings, cashier shifts, shared retail customers, server-side pricing, draft/confirm/payment/cancel order flows, stock integration, and internal invoice issuance. It also includes the Retail workspace with Customer and Settings subtabs.

This design refines `docs/dac-ta-model-retail.md` and `docs/dac-ta-api-fe-retail.md`. Decisions in this document take precedence for phase 1 where the source documents are ambiguous or conflict with the existing codebase.

## 2. Phase boundaries

### Included

- Register `retail` as an opt-in business module.
- Add `retail:operate` and `retail:manager` permissions.
- Add branch-scoped retail settings and its management UI.
- Add company-wide retail customers and their management UI.
- Add minimum cashier shift APIs needed for sales and reconciliation.
- Add server-authoritative quotes, draft orders, confirmation, later payments, and cancellation/refund.
- Integrate confirmed/cancelled orders with the existing Product and StockLog collections.
- Issue an immutable internal invoice snapshot on order confirmation.
- Add tenant, branch, permission, pricing, state-transition, concurrency, and transaction tests.

### Deferred

- POS selling UI, order-list UI, and shift-operation UI.
- PDF and ESC/POS rendering/printing.
- Sales returns and exchanges.
- IMEI/serial tracking.
- Retail dashboard, analytics, commission, customer tiers, and realtime events.

The backend APIs in phase 1 must be suitable for the deferred POS UI without redesigning the core transaction contract.

## 3. Module and authorization model

Retail is independent of the existing `education` and `labor` business types. Business-type filtering must not remove retail.

Retail is opt-in. Legacy companies whose module field is absent or empty must retain the old modules' compatibility behavior, but retail must remain disabled until it is explicitly present in `enabledModules`. New-company defaults must also exclude retail unless selected explicitly.

Only two retail permissions exist:

- `retail:operate`: access the Retail workspace; read/create/update customers; quote, create, confirm, and collect orders; open/close a cashier shift; cancel draft or non-completed orders; and perform ordinary retail operations.
- `retail:manager`: implies every `retail:operate` capability and additionally allows editing retail settings, seeing cost/profit information, reconciling shift variances, and cancelling completed orders.

Existing admin and superadmin behavior must map to manager capability consistently with the repository's authorization conventions. Backend enforcement is authoritative; frontend checks only control presentation.

## 4. Architecture

Create an isolated `server/modules/retail/` module with focused interfaces, models, validation, services, controllers, routes, middleware, and permission helpers. Mount it once behind authentication and `requireModule("retail")`.

The frontend gets a lazy-loaded Retail workspace. In phase 1 only the Customer and Settings subtabs are exposed. Later subtabs are added when their complete UI slices are implemented.

The main units are:

- Settings service: resolves branch defaults and validates manager updates.
- Customer service: maintains company-wide profiles and customer numbering.
- Pricing service: a pure function with no request, database, or clock dependency.
- Shift service: owns shift state, blind counting, and reconciliation summaries.
- Order service: owns order state transitions and idempotency.
- Stock service: applies and reverts stock inside the order transaction.
- Invoice service: allocates invoice numbers and creates immutable snapshots.

MongoDB transactions are required for multi-document money/stock operations. There is no non-transactional fallback because partial success can corrupt inventory and reconciliation. Deployment must use a MongoDB replica set or mongos, consistent with transaction-using services already present in the repository.

## 5. Data model

### 5.1 RetailSettings

One record per `{ companyCode, branchId }`, enforced by a unique index.

- `allowNegativeStock`: boolean, default `false`.
- `maxDiscountPercent`: number from 0 through 100, default `0`.
- `defaultTaxRate`: number from 0 through 100 with at most two decimal places, default `0`.
- `varianceReasonThreshold`: non-negative integer VND, default `0`.
- `orderPrefix`: validated uppercase prefix, default `DH`.
- `invoicePrefix`: validated uppercase prefix, default `HD`.

Missing settings resolve to these defaults without needing an eager migration. Only `retail:manager` can update them.

### 5.2 RetailCustomer and counter

Customers are shared across all branches in one company. `branchId` records the creating branch only and does not limit visibility, history, or debt aggregation.

Core fields are customer code, name, optional phone, email, address, notes, company code, origin branch, creator snapshot, and timestamps. There is no active status and no delete API. Profiles can be edited.

- Customer code: `KH-{companyCode}-{000001}`.
- Sequence: company-wide and never resets.
- A non-empty normalized phone is unique per company; multiple customers may omit phone.
- Sales, collected amount, and debt are derived from orders/payments rather than editable customer totals.

### 5.3 RetailOrder and counters

Orders retain the snapshot principles and monetary invariants from the model specification, with these phase-1 refinements:

- Order code: `{orderPrefix}-{branchCode}-{YYYYMM}-{000001}`.
- Sequence is separate per company, branch, and month; numbers are assigned only on successful confirmation.
- Draft orders use their MongoDB ID and never reserve stock.
- Product price/cost/name/SKU/unit/category are loaded by the server. A cashier cannot override unit price.
- Discounts may be submitted as percent or VND at line and order level. The server normalizes them to absolute snapshot amounts.
- Total effective discount is the sum of line and order discounts divided by the pre-discount merchandise total. It cannot exceed branch `maxDiscountPercent`, and no line/order total may become negative.
- Tax rate is entered per order, defaults from branch settings, ranges from 0 through 100, and has at most two decimal places. The server computes tax amount.
- Debt is not a payment method. A positive due amount requires a customer and due date.
- Payments include direction/type as needed, method, applied amount, received/refunded time, actor snapshots, shift ID, business date, reference, and cash tender/change snapshots.
- The initial confirmation supports split payments. Only cash tender may exceed the applied amount; the excess is `changeAmount` and never increases `paidAmount`.

The order state machine remains draft to confirmed/completed/cancelled. A confirmation paid in full becomes completed; a partial/unpaid confirmation remains confirmed. Later collection moves it to completed when due reaches zero.

### 5.4 RetailInvoice and counter

Invoice number: `{invoicePrefix}-{branchCode}-{YYYYMM}-{000001}`, using a sequence independent from orders. An immutable internal invoice is issued automatically during confirmation. Its customer and line snapshots never include unit cost. Phase 1 provides retrieval APIs but no PDF, ESC/POS, or print UI.

### 5.5 CashierShift

A branch cashier can have at most one open shift. When a non-empty terminal ID is supplied, that terminal can also belong to at most one open shift in that company/branch. Both rules are protected by partial unique indexes.

The shift business date is fixed when the shift opens. Orders, collections, and refunds performed during an overnight shift inherit that date until it closes.

Reconciliation stores or derives:

- gross sales;
- collected amount;
- newly created debt;
- refunded amount;
- net collected amount;
- method totals for actual collections/refunds;
- expected cash; and
- counted cash and variance.

Expected cash equals opening float plus cash collected plus cash movements in, minus cash movements out and cash refunds. Any absolute variance greater than the configured threshold requires a reason. With the default threshold of zero, every non-zero variance requires explanation.

The blind-count API never returns expected cash or revenue-derived hints before a count is submitted. Manager review becomes available only after the count/close flow reaches the appropriate state.

### 5.6 StockLog extension

Extend the existing StockLog schema/interface with `refType`, `refId`, and `idempotencyKey`. Add a unique partial index on `{ companyCode, idempotencyKey }` for records containing a string key.

Phase 1 uses:

- `order:{orderId}:out` for confirmation;
- `order:{orderId}:revert` for cancellation.

Retail only sells Products with an exact matching `companyCode` and `branchId`. Legacy products without a branch are ignored; no migration or fallback is required.

## 6. Pricing rules

The pure pricing service applies this fixed order:

1. Load authoritative product price and normalize each line discount.
2. Compute each integer-VND line total and reject a discount exceeding the line base.
3. Sum line totals into subtotal.
4. Normalize and subtract the order discount.
5. Verify the combined effective discount against branch settings.
6. Calculate integer-VND tax with `Math.round((subtotal - orderDiscount) * taxRate / 100)`.
7. Add the non-negative shipping fee.
8. Return line snapshots, subtotal, discount, tax, shipping, grand total, and total cost.

Quote and confirm call the same service. Confirm compares the server result with the client's `expectedGrandTotal`; a mismatch returns `ORDER_TOTAL_MISMATCH` with the current totals.

## 7. Transaction flows

### 7.1 Quote and draft

Quote is read-only and server-authoritative. Draft creation/update stores a working order but does not assign a formal number or reserve/decrement inventory. Draft items can be edited only while the order is draft.

### 7.2 Confirm

Confirm accepts the expected total, one idempotency key per checkout attempt, and initial split payments. In one MongoDB transaction it:

1. Resolves tenant/branch and an open cashier shift.
2. Claims or reuses the idempotency key.
3. Reloads the draft and authoritative products.
4. Recalculates pricing and validates the expected total.
5. Validates customer/due date for partial or unpaid sales.
6. Atomically validates/decrements exact-branch stock unless negative stock is enabled.
7. Allocates the order number.
8. Writes the outgoing stock log.
9. Records initial collections with the current shift/business date.
10. Allocates and issues the invoice snapshot.
11. Advances the order state and optimistic version.

Concurrent/retried confirmation returns the already committed result for the same idempotency key and cannot duplicate stock, order number, payment, or invoice.

### 7.3 Later collection

Later collection requires an open shift. It accepts one or more real payment methods, rejects applied overpayment, records shift/business date, and advances the order to completed at zero due. Cash tender/change follows the same rules as initial confirmation.

### 7.4 Cancellation and refund

An operator may cancel draft or non-completed orders. Cancelling a completed order requires manager permission. Every confirmed/completed cancellation requires a reason and, in one transaction, creates the stock reversal log and restores exact-branch stock.

Original collections are immutable. If money was collected, cancellation requires an explicit refund distribution using cash/card/transfer/ewallet and optional references. A refund requires an open current shift and is recorded as a separate transaction attached to that shift. Cash refunds reduce expected cash. The order then becomes cancelled/refunded without deleting its audit trail.

## 8. API surface for phase 1

All endpoints are under `/api/v1/retail`, tenant-scoped, branch-scoped where applicable, validated, and return the repository's standard success/error envelope.

- Settings: get resolved branch settings; manager update.
- Customers: paginated/searchable list, create, detail with derived summary/history, update.
- Shifts: current, list/detail, open, cash movement, close/count, manager reconcile/approve.
- Orders: quote, list/detail, create draft, update draft, confirm with payments, collect payment, cancel/refund.
- Invoices: list and detail retrieval only.

Superadmin requests must supply company and branch scope. Normal users derive company from their actor identity and may only use an allowed/current branch according to existing scope conventions.

## 9. Frontend for phase 1

Register the `BÁN LẺ` tab and lazy Retail workspace. The sidebar/router/module maps honor opt-in module and the two permissions.

### Customer subtab

- Search by code, name, or phone with debounce.
- Paginated table.
- Create and edit forms.
- Customer detail view with contact details, total sales, total collected, current debt, order history, and payment history.
- Optional branch filter applies to derived transactions, not profile visibility.
- No status toggle and no delete action.

### Settings subtab

- Branch selector follows current branch context.
- Controls for negative stock, maximum discount percent, default tax rate, variance explanation threshold, order prefix, and invoice prefix.
- Visible/readable to operators if useful, but editable only by managers.
- Validation errors are shown inline; saved values are always reloaded from the server response.

The existing shared API client, authentication context, branch context, forms/dialog patterns, pagination, and toast components should be reused. The worker-specific API client should be promoted to shared code only if phase-1 frontend calls need its refresh/error behavior, while retaining a compatibility re-export for worker management.

## 10. Error handling and invariants

Use typed `AppError` codes for missing shifts, already-open/closed shifts, insufficient stock, immutable orders, total mismatch, overpayment, discount-limit violations, idempotency conflict, and invalid transitions. Duplicate-key errors are translated into stable business responses where expected; unknown database errors remain internal errors.

Every query includes company scope. Branch-owned records additionally include exact branch scope. Cost fields are stripped unless the actor has manager capability, and invoice responses never expose cost to any role.

No controller performs monetary arithmetic or direct multi-model orchestration. Validation rejects invalid money, percentage precision, malformed IDs, unknown payment methods, and impossible tender/change combinations before service execution.

## 11. Verification strategy

- Pure pricing tests cover discounts in both representations, combined limits, tax precision/rounding, shipping, zero values, negative prevention, and total invariants.
- Settings tests cover defaults, manager enforcement, validation, tenant isolation, and branch isolation.
- Customer tests cover company-wide visibility, origin branch, phone uniqueness, numbering concurrency, no-delete contract, summaries, and cross-tenant isolation.
- Shift tests cover cashier/terminal uniqueness, blind count, overnight business date, cash movements, threshold reasons, and manager reconciliation.
- Order tests cover draft mutability, no draft reservation, exact-branch products, negative-stock setting, split payment, debt requirements, tender/change, later collection, state transitions, cancellation, refund, and cost stripping.
- Transaction/concurrency tests run parallel confirmations and retries and assert one stock decrement, one stock log, one order number, one payment set, and one invoice.
- Route/module tests ensure retail is opt-in, type-independent, mounted behind the module guard, and protected by the two catalogued permissions.
- Frontend tests cover tab visibility, manager-only setting edits, customer search/forms/detail, and API error mapping.
- Final verification runs targeted tests, full typecheck, and the production build.

## 12. Implementation sequence

1. Module keys, opt-in compatibility, permission helpers, route guard, shared API client, and tests.
2. Retail settings backend plus Settings subtab.
3. Retail customer backend plus Customer subtab.
4. Shift model/service/API and reconciliation tests.
5. Pricing service and exhaustive pure tests.
6. Order/invoice/counter models and draft/quote APIs.
7. StockLog extension and transactional confirm flow.
8. Later collection, cancellation/refund, and shift aggregation.
9. Cross-cutting isolation, concurrency, typecheck, and build verification.


