import { describe, expect, it } from "vitest";
import { invoicePaymentRows } from "./invoicePaymentDisplay";

describe("invoicePaymentRows", () => {
  it("shows localized payments and remaining partial debt", () => {
    expect(invoicePaymentRows({
      grandTotal: 100_000,
      paidAmount: 40_000,
      dueAmount: 60_000,
      paymentStatus: "partial",
      payments: [{ method: "transfer", amount: 40_000 }],
    })).toEqual([
      { label: "Chuyển khoản", amount: 40_000 },
      { label: "Còn nợ", amount: 60_000 },
    ]);
  });

  it("derives full debt for legacy invoices without summary fields", () => {
    expect(invoicePaymentRows({ grandTotal: 100_000, payments: [] })).toEqual([
      { label: "Ghi nợ toàn bộ", amount: 100_000 },
    ]);
  });

  it("marks refunded invoices distinctly", () => {
    expect(invoicePaymentRows({ grandTotal: 100_000, paidAmount: 100_000, dueAmount: 0, paymentStatus: "refunded", payments: [{ method: "cash", amount: 100_000 }] })).toContainEqual({
      label: "Đã hoàn tiền",
      amount: 100_000,
    });
  });
});
