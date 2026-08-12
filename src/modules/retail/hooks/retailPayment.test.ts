import { describe, expect, it } from "vitest";
import { buildPaymentSummary } from "./retailPayment";

describe("retail payment composer", () => {
  it("computes collected, remaining debt and cash change", () => {
    expect(buildPaymentSummary(500_000, [
      { method: "cash", amount: 200_000, tenderedAmount: 250_000 },
      { method: "transfer", amount: 100_000, reference: "TX-1" },
    ], { mode: "partial", customerId: "c1", dueDate: "2026-08-20" })).toEqual({ collected: 300_000, due: 200_000, change: 50_000 });
  });

  it("requires exact collection in full mode", () => {
    expect(buildPaymentSummary(500_000, [{ method: "cash", amount: 500_000 }], { mode: "full" })).toEqual({ collected: 500_000, due: 0, change: 0 });
    expect(() => buildPaymentSummary(500_000, [{ method: "cash", amount: 100_000 }], { mode: "full" })).toThrow(/đủ/i);
  });

  it("requires a customer, due date and a strict partial collection", () => {
    expect(() => buildPaymentSummary(500_000, [{ method: "cash", amount: 100_000 }], { mode: "partial" })).toThrow(/khách hàng/i);
    expect(() => buildPaymentSummary(500_000, [], { mode: "partial", customerId: "c1", dueDate: "2026-08-20" })).toThrow(/lớn hơn 0/i);
    expect(() => buildPaymentSummary(500_000, [{ method: "cash", amount: 500_000 }], { mode: "partial", customerId: "c1", dueDate: "2026-08-20" })).toThrow(/nhỏ hơn/i);
  });

  it("supports full debt only with no payment rows, customer and due date", () => {
    expect(buildPaymentSummary(500_000, [], { mode: "debt", customerId: "c1", dueDate: "2026-08-20" })).toEqual({ collected: 0, due: 500_000, change: 0 });
    expect(() => buildPaymentSummary(500_000, [], { mode: "debt" })).toThrow(/khách hàng/i);
    expect(() => buildPaymentSummary(500_000, [{ method: "cash", amount: 1 }], { mode: "debt", customerId: "c1", dueDate: "2026-08-20" })).toThrow(/không nhận tiền/i);
  });

  it("rejects overpayment and non-cash tender", () => {
    expect(() => buildPaymentSummary(100, [{ method: "cash", amount: 101, tenderedAmount: 101 }], { mode: "full" })).toThrow(/vượt/i);
    expect(() => buildPaymentSummary(100, [{ method: "card", amount: 100, tenderedAmount: 100 }], { mode: "full" })).toThrow(/tiền khách đưa/i);
  });
});
