# Retail POS Create Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full customer-creation popup to the Retail POS customer picker when a phone search returns no results, then automatically select the created customer.

**Architecture:** Keep search ownership in `CustomerPicker` and extract creation into a focused `CreateCustomerDialog`. The dialog reuses `retailCustomersApi.create`, returns the created `RetailCustomer`, and leaves cart ownership in the existing POS reducer through `onChange`.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, existing Retail API client and Tailwind classes.

## Global Constraints

- Every employee who can access POS can create a customer; add no permission.
- Fields are name, phone, email, address, and notes; name is required.
- Prefill phone from the unsuccessful search.
- Preserve cart state and automatically select the created customer.
- Show create action only after a non-empty successful search returns no rows.

---

### Task 1: Customer creation dialog

**Files:**
- Create: `src/modules/retail/components/pos/CreateCustomerDialog.tsx`
- Create: `src/modules/retail/components/pos/CreateCustomerDialog.test.tsx`

**Interfaces:**
- Consumes: `retailCustomersApi.create(input, scope)` and `RetailScope`.
- Produces: `CreateCustomerDialog({ scope, initialPhone, onClose, onCreated })`, where `onCreated(customer: RetailCustomer): void`.

- [ ] **Step 1: Write failing dialog tests**

Cover prefilled phone and five fields, required trimmed name, trimmed submit payload with scope, disabled submit while saving, successful callback, retained form plus API error, and cancel without API invocation.

- [ ] **Step 2: Verify tests fail**

Run: `npx vitest run src/modules/retail/components/pos/CreateCustomerDialog.test.tsx`

Expected: FAIL because `CreateCustomerDialog.tsx` does not exist.

- [ ] **Step 3: Implement the dialog**

Create a modal form with accessible dialog/name labels. Initialize `{ name: "", phone: initialPhone, email: "", address: "", notes: "" }`; trim all fields before calling `retailCustomersApi.create`; reject an empty trimmed name locally; retain values and render `role="alert"` on error; disable save while the request is pending; call `onCreated(created)` only after success.

- [ ] **Step 4: Verify dialog tests pass**

Run: `npx vitest run src/modules/retail/components/pos/CreateCustomerDialog.test.tsx`

Expected: all dialog tests PASS.

### Task 2: Integrate creation with customer search

**Files:**
- Modify: `src/modules/retail/components/pos/CustomerPicker.tsx`
- Modify: `src/modules/retail/components/pos/CustomerPicker.test.tsx`

**Interfaces:**
- Consumes: `CreateCustomerDialog` from Task 1.
- Produces: existing `CustomerPicker` contract unchanged; a successful create calls its existing `onChange(RetailCustomer)`.

- [ ] **Step 1: Write failing picker tests**

Extend the API mock with `create`. Test that “Tạo khách hàng mới” appears only after a non-empty successful empty search, is absent during loading/results/error, opens the dialog with the search phone, and successful creation clears search state and calls `onChange` with the returned customer.

- [ ] **Step 2: Verify picker tests fail**

Run: `npx vitest run src/modules/retail/components/pos/CustomerPicker.test.tsx`

Expected: FAIL because the create action and dialog integration are absent.

- [ ] **Step 3: Implement picker integration**

Track whether a search completed and dialog visibility. Reset completion on query changes, selection, or errors. Render the create button only for `query.trim() && !loading && !error && searchCompleted && items.length === 0`; pass the trimmed query as `initialPhone`; on creation clear query/results/completion, close the dialog, and call `onChange(customer)`.

- [ ] **Step 4: Verify picker tests pass**

Run: `npx vitest run src/modules/retail/components/pos/CustomerPicker.test.tsx src/modules/retail/components/pos/CreateCustomerDialog.test.tsx`

Expected: all picker and dialog tests PASS.

### Task 3: POS regression and full verification

**Files:**
- Modify only if needed: `src/modules/retail/pages/RetailPosPage.test.tsx`

**Interfaces:**
- Consumes: unchanged `CustomerPicker.onChange` contract and POS cart reducer.
- Produces: regression evidence that customer selection remains in quote/checkout without losing cart lines.

- [ ] **Step 1: Strengthen POS regression assertion**

Assert the mocked newly-created customer selection leaves the product line in the quote and supplies `customerId: "c1"`; retain the existing checkout-success assertion.

- [ ] **Step 2: Run focused Retail UI tests**

Run: `npx vitest run src/modules/retail/components/pos/CreateCustomerDialog.test.tsx src/modules/retail/components/pos/CustomerPicker.test.tsx src/modules/retail/pages/RetailPosPage.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 3: Run typecheck and production build**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 and frontend/server bundles generated.

- [ ] **Step 4: Review and commit implementation**

Run `git diff --check`, inspect the scoped diff, then commit the dialog, integration, and tests with message `feat: create customers from retail POS`.
