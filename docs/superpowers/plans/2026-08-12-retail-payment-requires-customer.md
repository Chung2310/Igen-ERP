# Retail Payment Requires Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent every Retail payment or order confirmation unless the order has a selected, valid customer.

**Architecture:** Apply defense in depth: a domain invariant shared by payment dialogs, an early POS entry guard, correct customer propagation for debt collection, and a server confirmation guard before side effects. Draft and held orders remain customer-optional.

**Tech Stack:** TypeScript, React, Testing Library, Vitest, Node test/assert, Mongoose.

## Global Constraints

- Every full, partial, debt, offline, and debt-collection payment requires a customer.
- Draft creation and holding remain customer-optional.
- Partial and debt modes still require a due date.
- Use the Vietnamese error copy `Vui lòng chọn khách hàng trước khi thanh toán.`
- Add no permission and no automatic walk-in customer.

---

### Task 1: Enforce the client payment-domain invariant

**Files:**
- Modify: `src/modules/retail/hooks/retailPayment.test.ts`
- Modify: `src/modules/retail/hooks/retailPayment.ts`

**Interfaces:**
- Consumes: `buildPaymentSummary(total, payments, { mode, customerId, dueDate })`.
- Produces: the same signature, now rejecting every mode when `customerId` is empty.

- [ ] **Step 1: Write the failing test**

```ts
it("requires a customer for full payment", () => {
  expect(() => buildPaymentSummary(500_000, [
    { method: "cash", amount: 500_000, tenderedAmount: 500_000 },
  ], { mode: "full" })).toThrow("Vui lòng chọn khách hàng trước khi thanh toán.");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/retail/hooks/retailPayment.test.ts`

Expected: FAIL because full payment currently accepts a missing customer.

- [ ] **Step 3: Add the minimal invariant before mode-specific checks**

```ts
if (!debt.customerId?.trim()) {
  throw new Error("Vui lòng chọn khách hàng trước khi thanh toán.");
}
```

- [ ] **Step 4: Run the domain tests and verify GREEN**

Run: `npx vitest run src/modules/retail/hooks/retailPayment.test.ts`

Expected: all tests pass; partial/debt due-date rules remain unchanged.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/retail/hooks/retailPayment.ts src/modules/retail/hooks/retailPayment.test.ts
git commit -m "fix: require customer for retail payments"
```

### Task 2: Guard the POS entry point and payment dialog

**Files:**
- Modify: `src/modules/retail/pages/RetailPosPage.test.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/components/pos/PaymentDialog.test.tsx`
- Modify: `src/modules/retail/components/pos/ClearPaymentDialog.tsx`

**Interfaces:**
- Consumes: `cart.customer?._id` and the Task 1 invariant.
- Produces: an `openPayment()` guard used by the cart's `onPay`; dialog submission never invokes `onSubmit` without a customer.

- [ ] **Step 1: Add failing POS and dialog behavior tests**

```ts
it("does not open payment without a selected customer", async () => {
  // Render the existing POS fixture with products and an open shift but no customer.
  // Add an item, click Thanh toán, and assert:
  expect(screen.queryByRole("dialog", { name: "Thanh toán" })).toBeNull();
  expect(screen.getByText("Vui lòng chọn khách hàng trước khi thanh toán.")).toBeTruthy();
});

it("does not submit full payment without a customer", async () => {
  const onSubmit = vi.fn();
  render(<PaymentDialog total={500_000} busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng chọn khách hàng trước khi thanh toán.");
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `npx vitest run src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/components/pos/PaymentDialog.test.tsx`

Expected: POS opens the dialog and full-payment dialog submits without a customer.

- [ ] **Step 3: Add the POS entry guard**

```ts
const openPayment = () => {
  if (!cart.customer?._id) {
    setMessage("Vui lòng chọn khách hàng trước khi thanh toán.");
    return;
  }
  setMessage("");
  setPaying(true);
};
```

Pass `openPayment` as `CartPanel.onPay`. Keep the existing shift-based `canPay` behavior so the customer failure gives actionable feedback.

- [ ] **Step 4: Keep dialog error handling accessible**

Continue calling `buildPaymentSummary` inside `ClearPaymentDialog.submit`; Task 1 makes the call reject before `onSubmit`. Ensure the existing error element retains `role="alert"` and displays the exact error.

- [ ] **Step 5: Run both test files and verify GREEN**

Run: `npx vitest run src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/components/pos/PaymentDialog.test.tsx`

Expected: both files pass and `onSubmit` remains untouched without a customer.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/retail/pages/RetailPosPage.tsx src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/components/pos/ClearPaymentDialog.tsx src/modules/retail/components/pos/PaymentDialog.test.tsx
git commit -m "fix: block customerless retail checkout"
```

### Task 3: Preserve customers in debt collection

**Files:**
- Create: `src/modules/retail/pages/RetailOrdersPage.test.tsx`
- Modify: `src/modules/retail/pages/RetailOrdersPage.tsx`

**Interfaces:**
- Consumes: `selected.customerId` from `RetailOrder`.
- Produces: `PaymentDialog customerId={selected.customerId}` and prevents collection for historical orders with no customer.

- [ ] **Step 1: Write a failing debt-collection test**

```ts
it("passes the order customer into debt collection", async () => {
  // Render an outstanding confirmed order with customerId: "c1".
  // Open details and Thu công nợ, then submit a valid full collection.
  // Assert the dialog does not show the missing-customer alert and the collect API is called.
});
```

Also cover a legacy order without `customerId`: clicking collection must show `Vui lòng chọn khách hàng trước khi thanh toán.` and must not open the payment dialog.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npx vitest run src/modules/retail/pages/RetailOrdersPage.test.tsx`

Expected: current dialog receives no `customerId`.

- [ ] **Step 3: Pass and guard the selected customer**

```tsx
const openCollection = () => {
  if (!selected?.customerId) {
    setError("Vui lòng chọn khách hàng trước khi thanh toán.");
    return;
  }
  setCollecting(true);
};

<PaymentDialog
  total={selected.dueAmount}
  busy={false}
  customerId={selected.customerId}
  onClose={() => setCollecting(false)}
  onSubmit={(payments) => collect(payments)}
/>
```

- [ ] **Step 4: Run the page test and verify GREEN**

Run: `npx vitest run src/modules/retail/pages/RetailOrdersPage.test.tsx`

Expected: all order-page tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/retail/pages/RetailOrdersPage.tsx src/modules/retail/pages/RetailOrdersPage.test.tsx
git commit -m "fix: retain customer during debt collection"
```

### Task 4: Reject customerless confirmation on the server

**Files:**
- Modify: `server/modules/retail/services/retail-order.service.test.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`

**Interfaces:**
- Consumes: the draft loaded by `RetailOrderService.confirm` and `resolveOrderCustomer(scope, draft.customerId, session)`.
- Produces: confirmation error `Vui lòng chọn khách hàng trước khi thanh toán.` before payment, stock, invoice, event, or receivable side effects.

- [ ] **Step 1: Add an extracted validation test**

Expose a focused pure guard for direct unit testing:

```ts
export function requireRetailPaymentCustomer(customerId: unknown) {
  if (!String(customerId || "").trim()) {
    throw new Error("Vui lòng chọn khách hàng trước khi thanh toán.");
  }
}

test("confirmation requires a customer even when fully paid", () => {
  assert.throws(() => requireRetailPaymentCustomer(undefined), /chọn khách hàng/i);
  assert.doesNotThrow(() => requireRetailPaymentCustomer("c1"));
});
```

Write the test/import first; do not add the function until RED is observed.

- [ ] **Step 2: Run the service test and verify RED**

Run: `node --import tsx --test server/modules/retail/services/retail-order.service.test.ts`

Expected: FAIL because `requireRetailPaymentCustomer` is not exported.

- [ ] **Step 3: Implement and call the guard in confirmation**

Immediately after loading the draft inside the confirmation transaction:

```ts
requireRetailPaymentCustomer(draft.customerId);
const customer = await resolveOrderCustomer(scope, draft.customerId, session);
```

Retain the existing `dueAmount > 0` due-date validation, but remove customer presence from that narrower condition because the new guard applies to all modes.

- [ ] **Step 4: Run server tests and verify GREEN**

Run: `node --import tsx --test server/modules/retail/services/retail-order.service.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add server/modules/retail/services/retail-order.service.ts server/modules/retail/services/retail-order.service.test.ts
git commit -m "fix: reject customerless retail confirmations"
```

### Task 5: Full verification

**Files:**
- Verify only; no production changes expected.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: evidence that customer enforcement and existing Retail flows remain valid.

- [ ] **Step 1: Run the complete affected test group**

```powershell
npx vitest run src/modules/retail/hooks/retailPayment.test.ts src/modules/retail/components/pos/PaymentDialog.test.tsx src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/pages/RetailOrdersPage.test.tsx src/modules/retail/components/pos/CreateCustomerDialog.test.tsx src/modules/retail/components/pos/CustomerPicker.test.tsx
node --import tsx --test server/modules/retail/services/retail-order.service.test.ts
```

Expected: all selected test files pass with zero failures.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite client and esbuild server bundles complete with exit code 0.

- [ ] **Step 4: Inspect repository state**

Run: `git status --short --branch` and `git log -6 --oneline`.

Expected: clean worktree with the design, plan, and implementation commits ahead of the tracked remote.
