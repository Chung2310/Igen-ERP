# Retail invoice cashier and payment display

## Goal

Retail invoices must show the cashier's human-readable name and explain how the order was paid, including full debt and partial debt cases, consistently in the invoice dialog, browser print view, and downloaded PDF.

## Cashier identity

- Authentication enriches the request actor with the user's persisted `displayName`.
- Newly issued invoices store that name in both `snapshot.cashierName` and `issuedByName`; email remains only a last-resort fallback.
- Invoice reads may resolve `issuedBy` to the current user's display name for legacy invoices whose stored cashier name is an email. This is a response-only compatibility projection and does not mutate the immutable invoice snapshot.
- If the referenced user no longer exists, the stored historical value remains visible.

## Payment snapshot

The immutable invoice snapshot stores:

- existing individual payment rows (`method`, amount, tendered/change amounts, reference);
- `paidAmount`;
- `dueAmount`;
- `paymentStatus` (`unpaid`, `partial`, `paid`, or `refunded`).

The values are copied from the completed order at invoice issue time. Existing invoices without the new fields derive paid amount from payment rows and remaining debt from `grandTotal - paidAmount` for display compatibility.

## Display rules

Payment method labels are localized: cash is `Tiền mặt`, transfer is `Chuyển khoản`, card is `Thẻ`, and e-wallet is `Ví điện tử`.

- Fully paid: show all payment rows.
- Partially paid: show all payment rows and `Còn nợ` with the outstanding amount.
- Fully unpaid: show `Ghi nợ toàn bộ` with the grand total.
- Refunded: retain payment rows and show the localized payment status where applicable.

These rules are shared by the detail dialog, browser receipt, and PDF so the three representations do not disagree.

## Validation and compatibility

- Monetary snapshot fields remain integer VND values and cannot be negative.
- `paidAmount + dueAmount` must match the invoice total at issue time, excluding refund semantics already represented by order status.
- New fields remain optional at the storage/type boundary so legacy invoices continue to render.
- No backfill or mutation of existing invoices is performed.

## Tests

- Authentication request actors include `displayName` from the database record.
- Snapshot creation prefers the human-readable cashier name and captures payment/debt totals.
- Legacy invoice projection replaces email-like cashier values when a referenced user is available.
- UI and print tests cover cash/transfer labels, partial debt, and full debt.
- PDF rendering tests verify the payment/debt section is emitted without breaking Unicode output.
