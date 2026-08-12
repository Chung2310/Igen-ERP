# Retail Payment Requires Customer Design

## Goal

Require a selected, valid customer for every Retail payment, including full payment, partial payment, full debt, offline checkout, and later debt collection.

## Scope

- Draft orders may still be created, edited, or held without a customer.
- An order cannot enter the payment/confirmation flow without a customer.
- Existing confirmed orders retain their customer when collecting outstanding debt.
- No new permission is introduced.

## Client behavior

### POS entry gate

The POS payment action checks the current cart customer before opening the payment dialog. If no customer is selected, it keeps the dialog closed and shows a clear message asking the employee to select or create a customer.

The existing shift requirement remains independent from the customer requirement.

### Payment dialog validation

The payment dialog validates `customerId` for all three modes before submitting:

- Full payment
- Partial payment
- Full debt

If missing, it does not call `onSubmit` and displays an accessible error message. This protects alternate callers and stale UI states in addition to the POS entry gate.

### Debt collection

The Retail orders page passes the selected order's `customerId` into the payment dialog when collecting debt. Orders without a customer cannot start a new collection.

## Domain and API validation

`buildPaymentSummary` rejects a missing customer before mode-specific payment checks. Partial and debt modes continue to require a due date.

The server confirmation transaction rejects a draft without a valid customer regardless of the amount collected or resulting balance. Customer validation occurs before inventory, payment, invoice, receivable, or event side effects.

Draft creation remains backward-compatible: customer is optional until confirmation.

## Offline behavior

The POS gate prevents creation of new customerless offline checkout items. Server confirmation remains the final authority when queued items synchronize. Existing invalid queued data fails safely instead of producing a confirmed customerless order.

## Error handling

Use a direct Vietnamese message equivalent to: `Vui lòng chọn khách hàng trước khi thanh toán.` The UI keeps the cart and entered payment values intact so the employee can select/create a customer and retry.

## Tests

- Payment domain test: full payment without `customerId` is rejected.
- Payment dialog test: all modes refuse submission without `customerId`.
- POS page test: clicking payment without a customer does not open the dialog and shows guidance.
- Orders page test: debt collection supplies the order customer to the dialog or refuses customerless orders.
- Server service test: confirmation validation rejects a draft without a customer before side effects.
- Existing Retail payment, offline, typecheck, and production build verification remain green.

## Out of scope

- Making customer mandatory while merely drafting or holding an order.
- Creating a new customer permission.
- Migrating historical customerless completed orders.
- Automatically assigning a generic walk-in customer.
