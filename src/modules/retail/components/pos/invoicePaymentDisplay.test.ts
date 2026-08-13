import { describe, expect, it } from "vitest";
import { invoicePaymentRows, invoicePaymentSummary } from "./invoicePaymentDisplay";

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

describe("invoicePaymentSummary", () => {
  it("shows a single localized payment method", () => {
    expect(invoicePaymentSummary({ grandTotal: 100_000, payments: [{ method: "cash", amount: 100_000 }] })).toEqual({ label: "Tiền mặt" });
  });

  it("shows mixed payment when multiple methods were used", () => {
    expect(invoicePaymentSummary({ grandTotal: 100_000, payments: [{ method: "cash", amount: 50_000 }, { method: "transfer", amount: 50_000 }] })).toEqual({ label: "Thanh toán hỗn hợp" });
  });

  it("shows full debt for an unpaid invoice", () => {
    expect(invoicePaymentSummary({ grandTotal: 100_000, payments: [] })).toEqual({ label: "Ghi nợ toàn bộ", dueAmount: 100_000 });
  });

  it("shows both paid and due amounts for a partial invoice", () => {
    expect(invoicePaymentSummary({ grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, paymentStatus: "partial", payments: [{ method: "transfer", amount: 40_000 }] })).toEqual({
      label: "Thanh toán một phần",
      paidAmount: 40_000,
      dueAmount: 60_000,
    });
  });
});
