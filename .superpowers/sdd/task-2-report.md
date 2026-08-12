# Task 2 Report: Guard the POS entry point and payment dialog

- Status: DONE
- Task implementation commit: `41022b0a72f774dd2ca3383c5d5682e2d3e388b1` (`fix: block customerless retail checkout`)

## Files changed

- `src/modules/retail/pages/RetailPosPage.tsx`
- `src/modules/retail/pages/RetailPosPage.test.tsx`
- `src/modules/retail/components/pos/PaymentDialog.test.tsx`

`ClearPaymentDialog.tsx` was not changed: it already calls `buildPaymentSummary` before `onSubmit` and renders thrown errors in its existing `role="alert"`.

## RED

Command:

```text
npx vitest run src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/components/pos/PaymentDialog.test.tsx
```

Result: 1 failed, 10 passed (11 total). The new POS test failed exactly because the mocked payment dialog opened without a selected customer. The new full-payment dialog test was already green because Task 1 (`a2088990`) made `buildPaymentSummary` reject the missing customer before `onSubmit`.

The first sandboxed attempt could not start Vite because esbuild child-process spawning was denied (`spawn EPERM`); the elevated rerun produced the RED result above.

## GREEN

Command:

```text
npx vitest run src/modules/retail/pages/RetailPosPage.test.tsx src/modules/retail/components/pos/PaymentDialog.test.tsx
```

Result: 2 test files passed; 11 tests passed; 0 failed.

## Self-review

- The POS guard keeps the shift-based `canPay` independent, so an open shift with no customer leaves the button actionable and shows exact guidance.
- Both the cart payment button and shortcut use the same focused `openPayment` guard.
- The dialog test validates the accessible alert and verifies `onSubmit` is not called.
- The existing offline-checkout fixture now explicitly selects its available customer, preserving its intended network-failure coverage under the new business rule.
- `git diff --check` was clean before commit.

## Dependency observations

Task 1 centralizes payment validation in `buildPaymentSummary`; Task 2 intentionally adds no duplicate dialog validation. Draft creation and holding remain customer-optional.

## Concerns

None.
