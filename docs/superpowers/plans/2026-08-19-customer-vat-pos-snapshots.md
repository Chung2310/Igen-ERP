# Customer VAT Profiles and POS Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiple VAT billing profiles per customer and persist the selected immutable VAT snapshot through POS orders and invoices.

**Architecture:** Customer owns billing-profile persistence and validation. Retail stores only selected identifiers on drafts and immutable Customer/VAT snapshots on confirmed orders and invoices, resolving data through Customer contracts rather than importing Customer models.

**Tech Stack:** TypeScript, Express, Mongoose, React, Node test runner, Vitest/Testing Library.

## Global Constraints

- A customer may have multiple VAT profiles and at most one active default.
- Tax ID reuse across customers is warning-only; uniqueness is not enforced.
- POS creation of VAT profiles requires `customer:manage`.
- Retail may import Customer contracts but never Customer Mongoose models.
- Confirmed order and invoice snapshots never change after profile edits.

---

### Task 1: VAT profile domain and contracts

**Files:**
- Create: `server/modules/customer-management/interfaces/customer-billing-profile.interface.ts`
- Create: `server/modules/customer-management/models/customer-billing-profile.model.ts`
- Create: `server/modules/customer-management/billing-profile.service.ts`
- Create: `server/modules/customer-management/billing-profile.service.test.ts`
- Modify: `server/modules/customer-management/contracts.ts`

**Interfaces:**
- Produces: `BillingProfileSnapshot`, `listBillingProfiles`, `getBillingProfile`, `createBillingProfile`.

- [ ] Write failing tests for required legal name/tax ID/address/email, one default, first-profile customer conversion, tax-ID warnings, company scope, and inactive exclusion.
- [ ] Run `node_modules\.bin\tsx.cmd --test --test-force-exit server/modules/customer-management/billing-profile.service.test.ts`; expect RED.
- [ ] Implement model/service with repository injection and plain-data contracts.
- [ ] Rerun tests; expect PASS.
- [ ] Commit `feat(customer): add VAT billing profiles`.

### Task 2: VAT profile HTTP API and Customer UI

**Files:**
- Modify: `server/modules/customer-management/customer.controller.ts`
- Modify: `server/modules/customer-management/router.ts`
- Modify: `server/modules/customer-management/customer.routes.test.ts`
- Modify: `src/modules/customer-management/types.ts`
- Modify: `src/modules/customer-management/customerApi.ts`
- Create: `src/modules/customer-management/components/BillingProfilesPanel.tsx`
- Modify: `src/modules/customer-management/CustomerWorkspace.tsx`

**Interfaces:**
- Produces: billing-profile list/create/update/activate/deactivate endpoints below `/customers/:id/billing-profiles`.

- [ ] Add failing route/API/component tests proving read/manage guards and multiple profiles.
- [ ] Run focused Node/Vitest tests; expect RED.
- [ ] Implement endpoints and panel; keep mutation controls behind `customer:manage`.
- [ ] Rerun focused tests; expect PASS.
- [ ] Commit `feat(customer): manage VAT profiles`.

### Task 3: Retail order and invoice VAT snapshots

**Files:**
- Modify: `server/modules/retail/interfaces/retail-order.interface.ts`
- Modify: `server/modules/retail/models/retail-order.model.ts`
- Modify: `server/modules/retail/interfaces/retail-invoice.interface.ts`
- Modify: `server/modules/retail/models/retail-invoice.model.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/services/retail-invoice.service.ts`
- Modify: corresponding Retail service/model tests.

**Interfaces:**
- Consumes: `getCustomerBrief`, `getBillingProfile`.
- Produces: `billingProfileId?`, `customerSnapshot`, `billingSnapshot?` on Retail orders and invoices.

- [ ] Add failing tests proving draft identifiers, confirmation revalidation, inactive rejection, and immutable invoice snapshots.
- [ ] Run focused Retail tests; expect RED.
- [ ] Replace direct new-Customer lookup with Customer contracts and add snapshot schemas.
- [ ] Rerun tests; expect PASS.
- [ ] Commit `feat(retail): snapshot customer VAT details`.

### Task 4: POS Customer/VAT selection and milestone verification

**Files:**
- Modify: `src/modules/retail/types.ts`
- Modify: `src/modules/retail/hooks/retailCart.ts`
- Modify: `src/modules/retail/hooks/retailOrderInput.ts`
- Modify: `src/modules/retail/components/pos/CustomerPicker.tsx`
- Create: `src/modules/retail/components/pos/BillingProfilePicker.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: focused POS tests.

**Interfaces:**
- Consumes: Customer search/quick-create and billing-profile API.
- Produces: POS cart `billingProfile`, order input `billingProfileId`.

- [ ] Add failing tests for Customer-module search, VAT choice, profile creation permission, order input, and cart preservation on errors.
- [ ] Implement picker and order input wiring.
- [ ] Run all Customer/affected Retail tests, `npm run typecheck`, and `npm run build`.
- [ ] Confirm no Customer model imports exist in Retail.
- [ ] Commit verification fixes only when required.
