# Retail Shift Currency Inputs Design

## Problem

The cashier shift page uses native number inputs for opening cash, counted cash, and cash movements. These inputs do not format Vietnamese currency while typing. The opening-shift service also accepts an opening float of zero even though a shift must start with a positive cash float.

## User interface

Reuse the existing Retail `CurrencyInput` component for:

- `Tiền đầu ca`
- `Tiền thực đếm`
- the amount used for `Thu thêm` and `Rút tiền`

Each field will display integer VND using the `vi-VN` thousands separator and a visible `₫` suffix. No new currency-input implementation will be introduced.

The opening-shift button will be disabled while the opening float is not a positive safe integer. This gives immediate feedback but is not the security boundary.

Counted cash remains valid at zero because a drawer may contain no cash at close. Cash movement amounts retain their existing rule that they must be positive integers.

## API validation

The cashier shift service will require `openingFloat` to be a positive safe integer. Zero, negative, fractional, missing, and non-numeric values will produce a shared `ValidationError` with:

- HTTP status: `400`
- code: `SHIFT_OPENING_FLOAT_INVALID`
- message: `Quỹ đầu ca phải lớn hơn 0.`

The central error-code catalog will register `SHIFT_OPENING_FLOAT_INVALID`. The controller and global API error middleware remain unchanged.

## Testing

- Add a backend regression test proving zero opening cash normalizes to the specified public validation response.
- Add a page-level UI test proving all three money fields use Vietnamese currency formatting.
- Add a UI test proving the open button is disabled at zero and enabled for a positive value.
- Run the full retail backend tests, frontend retail tests, TypeScript typecheck, and `git diff --check`.

## Out of scope

- Changing the closing cash validation rule.
- Changing cash movement business rules.
- Changing shift scheduling or reconciliation behavior.
- Creating a new generic currency component.
