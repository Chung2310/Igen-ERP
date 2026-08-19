# Customer Management Module Design

**Date:** 2026-08-19

**Status:** Approved for implementation planning

## 1. Goal

Promote the customer capabilities currently embedded in Retail/POS into a complete, independently owned `customer` business module. The module manages company-wide customer profiles, VAT billing profiles, sales history, receivables, automatic tiers, and Excel import/export. POS becomes a consumer of the module and retains only checkout-specific customer selection and quick-create experiences.

## 2. Scope

The first release includes:

- Company-wide customer profiles and search.
- Regular and VAT customer classification.
- Multiple VAT billing profiles per customer.
- Company-wide order history and receivable visibility.
- Debt collection from the customer detail screen.
- Automatic tiers based on company-wide net sales.
- Excel validation, import, error reporting, and export.
- POS integration for customer search, quick creation, and VAT-profile selection.
- Archival of legacy POS customer records without breaking historical orders.

The first release excludes interaction timelines, follow-up tasks, marketing campaigns, remarketing automation, arbitrary custom fields, attachments, and manual tier overrides.

## 3. Ownership and Boundaries

The existing module key remains `customer`; no new `crm` module key is introduced.

Frontend code lives under `src/modules/customer-management/`. Backend code lives under `server/modules/customer-management/` and is exposed below `/api/customers` through the application's existing API mount convention.

The Customer module exclusively owns active customer profiles, VAT billing profiles, customer tiers, tier history, import jobs, and export jobs. It does not own retail orders or the receivable ledger.

Retail owns orders, invoice snapshots, and the current receivable ledger. Customer reads order and receivable projections through explicitly exported Retail contracts. Customer records debt collection through a Retail contract so that ledger and order payment state remain transactionally consistent. Customer code must not import Retail Mongoose models directly.

Retail/POS reads or creates customers through explicitly exported Customer contracts. Retail code must not import Customer Mongoose models directly. Checkout stores immutable customer and VAT snapshots so later profile edits do not change historical documents.

Customer identity, customer codes, tier calculation, sales totals, order history, and receivables are company-wide. A user with `customer:read` can see the company's complete customer data regardless of their currently selected branch.

## 4. Permissions

The release keeps the existing two-level permission model:

- `customer:read`: open the module, search and view profiles, VAT profiles, sales history, receivables, tier history, and export Excel.
- `customer:manage`: create and edit profiles, activate or deactivate profiles, manage VAT profiles, import Excel, collect debt, and configure or recalculate tiers.

POS customer search remains available to an authorized POS seller through the Customer search contract. Quick creation or creation of a VAT profile from POS requires `customer:manage`.

## 5. Customer Data

### 5.1 Customer

A customer contains:

- Company-scoped, permanent, automatically generated customer code.
- Type: `regular` or `vat`.
- Full name, normalized phone, optional email, date of birth, gender, contact address, and notes.
- Status: `active` or `inactive`.
- Current tier reference and cached company-wide net-sales total for efficient listing.
- Source, creator identity, timestamps, and optimistic concurrency version.

The normalized phone is unique within a company. Creation and import reject a phone that belongs to an active or inactive record; deactivation never releases the identity for reuse.

Customers referenced by any business transaction are never physically deleted. Deactivation preserves all history and prevents the customer from appearing in default search results or being selected for a new order. An inactive customer remains visible when opening an old order or direct customer URL.

### 5.2 VAT billing profiles

VAT details are stored as separate customer-owned records. Each profile contains:

- Legal company name.
- Tax identification number.
- Registered/invoice address.
- Invoice recipient email.
- Buyer or contact name.
- Default flag and active status.
- Creator identity, timestamps, and optimistic concurrency version.

A customer may own multiple VAT profiles but at most one active profile is default. Creating the first VAT profile changes the customer type to `vat`. A VAT customer must keep at least one active VAT profile; deactivating the last profile changes the customer back to `regular`.

Tax identification numbers are format-validated. Reuse of a tax identification number by different customers produces an explicit warning but is allowed because multiple buyers may represent the same legal entity.

A VAT profile referenced by a draft order cannot be deactivated until the draft stops using it. Confirmed orders and issued invoices use snapshots and therefore do not block later profile deactivation.

## 6. Module Experience

### 6.1 Customer list

The list supports server-side pagination and search by customer code, name, phone, email, legal company name, or tax identification number. Filters include status, customer type, tier, and transaction date range.

Each row shows identity and contact data, current tier, company-wide net sales, current receivable balance, last purchase time, and most recent purchasing branch. Actions include create, edit, deactivate/reactivate, open details, import, and export.

### 6.2 Customer detail

The detail experience contains independently loadable sections:

- Profile summary and editing.
- VAT billing profiles.
- Company-wide order history.
- Current receivable balance, open debtor orders, and collection history.
- Current tier, qualifying net sales, and tier-change history.

Each long collection is paginated by the server. Failure in order history, receivables, or tier history does not hide the base profile; the affected section renders its own retryable error state.

### 6.3 Debt collection

A manager may select one or more open receivable items for a single customer, enter an amount, payment method, reference, and note, then record a collection.

The server rejects zero or negative amounts and amounts above the combined selected balance. It allocates payment deterministically from the oldest selected due item to the newest unless the request supplies smaller per-item allocations whose sum equals the payment amount. A client-generated idempotency key prevents double collection on retries.

The Retail contract writes the ledger entries and updates affected order payment totals and statuses in its existing transaction boundary. Customer displays the returned result and refreshes the receivable projection; it never maintains a second balance.

### 6.4 Automatic customer tiers

Tier thresholds are non-negative, strictly increasing company-wide net-sales amounts. The first tier starts at zero. Tier codes are stable identifiers; display names and thresholds are editable.

Qualifying sales include confirmed or completed orders. The amount is net of cancellations and refunds. Draft and cancelled sales do not qualify. Reprocessing an order or refund is idempotent.

Order confirmation, completion, cancellation, and refund enqueue tier refreshes. A background job recalculates the customer's qualifying net sales, resolves the matching tier, updates the cached values, and records tier history only when the resolved tier changes.

Changing thresholds starts a company-wide recalculation job with progress, success/failure counts, timestamps, and an error summary. POS reads the current computed tier and never calculates it locally. Manual tier overrides are outside this release.

## 7. POS Integration

The POS customer picker searches active customers through a compact Customer search contract and displays customer code, phone, and current tier. It may quick-create a basic regular customer with name and phone when the user has `customer:manage`.

For VAT checkout, the cashier selects one of the customer's active billing profiles. A cashier with `customer:manage` may create another VAT profile without leaving POS. The first profile becomes default; otherwise POS initially selects the customer's default profile but allows another selection.

The order draft stores the selected customer and billing-profile identifiers. Confirmation resolves both records again, rejects inactive or missing selections, and stores immutable customer and VAT snapshots on the order and invoice. Failed search, quick creation, or VAT-profile creation keeps the cart and entered payment state intact.

## 8. Excel Import and Export

### 8.1 Import

Import uses a downloadable template. One row represents a customer and at most one VAT profile. Repeated normalized phone numbers in the same file are grouped into one customer; distinct tax IDs on those rows create multiple VAT profiles.

The workflow has two explicit phases:

1. Upload and validate without persisting business records.
2. Confirm a stored validation result and import its valid rows.

Validation normalizes phones, trims text, validates emails, parses dates, validates gender and customer type values, checks VAT requirements, detects conflicting repeated customer data, and detects phones already present in active or inactive Customer data. Existing customers are not overwritten.

Confirmation imports valid groups and skips invalid groups. The completed job reports counts and exposes an error workbook containing the original rows plus a Vietnamese error-reason column. A confirmed validation token cannot be reused.

### 8.2 Export

Export respects the list's current filters or exports the complete company-wide dataset. It contains profile fields, status, tier, net sales, receivable balance, last purchase data, and one output row per VAT profile. Customers without VAT profiles still produce one row.

Small exports may stream immediately. Exports above a configured row threshold run as jobs and provide a downloadable file after completion. Generated files are access-controlled by company and expire according to the application's existing temporary-file policy.

## 9. Legacy POS Data Transition

Existing `RetailCustomer` data is not promoted into the new active customer collection. A one-time migration marks every legacy Retail customer as archived and records the migration timestamp. Archived customers are excluded from new POS searches and cannot be attached to new drafts.

Historical orders retain their stored customer name and phone snapshots and their original legacy customer identifier. Existing order, invoice, warranty, and report views continue to render from snapshots. Direct dereferencing of a missing new Customer record must not be required for historical display.

The new Customer collection starts empty and is populated through manual creation or the clean Excel import. Phone uniqueness applies only inside the new collection, so a newly imported customer may share a phone with an archived legacy customer.

The migration is idempotent, reports examined and archived counts, and supports a dry-run mode. It does not rewrite historical order identifiers or delete legacy data.

## 10. API and Contract Shape

The HTTP surface is grouped below `/api/customers`:

- Customer list, create, detail, update, activate, and deactivate.
- Customer billing-profile list, create, update, activate, and deactivate.
- Order history, receivable summary/history, debt collection, and tier history.
- Tier settings, recalculation start, and recalculation-job status.
- Import template, validation, confirmation, job status, and error workbook.
- Export start, job status, and file download.

List endpoints use a consistent `{ items, total, page, limit }` shape. Mutations return stable machine-readable error codes alongside Vietnamese user-facing messages.

Customer exports typed contracts for active-customer search, customer lookup, quick creation, billing-profile lookup, and checkout validation. Retail exports typed contracts for customer order projection, receivable projection, and idempotent debt collection. Contracts return plain data and never expose Mongoose documents or models.

## 11. Error Handling, Concurrency, and Audit

Stable errors cover duplicate phone, invalid VAT profile, inactive customer, inactive billing profile, billing profile used by a draft, invalid tier thresholds, import validation expiry, repeated import confirmation, over-collection, idempotency conflict, and optimistic concurrency conflict.

Profile and billing-profile updates use optimistic concurrency. A stale update returns a conflict and the UI offers reload rather than silently overwriting another user's changes.

Audit records are mandatory for profile activation changes, VAT-profile mutations, imports, debt collections, tier-configuration changes, and tier recalculations. Logs include company, actor, action, target, timestamp, and safe before/after metadata. Sensitive spreadsheet contents are not copied wholesale into audit logs.

## 12. Verification Strategy

Unit coverage includes normalization, permanent phone uniqueness rules, customer-state transitions, default VAT-profile invariants, tax-ID warnings, tier resolution, net-sales inputs, debt allocation, and spreadsheet mapping/grouping.

Backend integration coverage includes both permissions, company isolation, company-wide reads across branches, Customer/Retail contract boundaries, idempotent debt collection, import validation and confirmation, tier recalculation, and archived-legacy exclusion.

Frontend component coverage includes list filters and pagination, resilient detail sections, profile and VAT editing, collection validation, import preview/results, export jobs, and POS customer/VAT selection while preserving cart state on error.

Migration coverage proves dry-run behavior, idempotent archival, exclusion from new selection, unchanged historical identifiers, and continued rendering of legacy order snapshots.

The critical end-to-end flow is: import a customer with multiple VAT profiles, select the customer and a VAT profile in POS, complete a sale, observe the order and receivable in Customer, collect the debt in Customer, and observe the updated order and ledger balance.

## 13. Delivery Sequence

Implementation is divided into independently verifiable milestones:

1. New Customer domain, data models, permissions, and core CRUD/search contracts.
2. VAT billing profiles and POS snapshot support.
3. Company-wide order and receivable projections plus debt collection.
4. Automatic tier settings, event-driven refresh, and recalculation jobs.
5. Excel validation/import/export jobs.
6. Customer frontend workspace and POS migration to Customer contracts.
7. Idempotent legacy archival migration and complete regression verification.

Each milestone must keep existing historical Retail documents readable and must not introduce direct cross-module model imports.
