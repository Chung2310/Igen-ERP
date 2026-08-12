import { describe, expect, it } from "vitest";
import { buildPaymentSummary } from "./retailPayment";

describe("retail payment composer", () => {
  it("computes collected, remaining debt and cash change", () => {
    expect(buildPaymentSummary(500_000, [
      { method: "cash", amount: 200_000, tenderedAmount: 250_000 },
      { method: "transfer", amount: 100_000, reference: "TX-1" },
    ], { customerId: "c1", dueDate: "2026-08-20" })).toEqual({ collected: 300_000, due: 200_000, change: 50_000 });
  });

  it("rejects remaining debt without customer and due date", () => {
    expect(() => buildPaymentSummary(500_000, [{ method: "cash", amount: 100_000 }], {})).toThrow(/khách hàng/i);
  });

  it("rejects overpayment and non-cash tender", () => {
    expect(() => buildPaymentSummary(100, [{ method: "cash", amount: 101, tenderedAmount: 101 }], {})).toThrow(/vượt/i);
    expect(() => buildPaymentSummary(100, [{ method: "card", amount: 100, tenderedAmount: 100 }], {})).toThrow(/tiền khách đưa/i);
  });
});
