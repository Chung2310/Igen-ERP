import { describe, expect, it } from "vitest";
import { projectCashEntries, summarizeCash, assertCashRange } from "./retail-cashbook.service";
import { buildProfitLines } from "./retail-profit.service";
import { commissionAmount } from "./retail-commission.service";

describe("retail finance source reconciliation", () => {
  it("counts payments, refunds, buyback and payout once", () => {
    const entries = projectCashEntries(
      [{ _id: "o1", orderCode: "DH1", payments: [{ businessDate: "2026-10-21", method: "cash", amount: 100, shiftId: "s1" }], refunds: [{ businessDate: "2026-10-21", method: "cash", amount: 20, shiftId: "s1" }] }],
      [{ _id: "a1", type: "buyback", code: "TM1", businessDate: "2026-10-21", paymentMethod: "cash", totalAmount: 30 }],
      [{ _id: "s1", businessDate: "2026-10-21", cashMovements: [{ type: "out", amount: 30, reason: "Thu mua TM1: máy cũ" }, { type: "in", amount: 5, reason: "Bổ sung quỹ" }] }],
      [], [{ _id: "p1", businessDate: "2026-10-21", account: "bank", amount: 7, partnerId: "partner" }],
    );
    expect(entries).toHaveLength(5);
    expect(summarizeCash(entries)).toMatchObject({ cashNet: 55, bankNet: -7, count: 5 });
  });
  it("rejects duplicate source keys and invalid ranges", () => {
    expect(() => projectCashEntries([], [], [], [{ sourceKey: "voucher:x", businessDate: "2026-10-21", account: "cash", direction: "in", amount: 1, reason: "A" }, { sourceKey: "voucher:x", businessDate: "2026-10-21", account: "cash", direction: "in", amount: 1, reason: "B" }])).toThrow(/ghi trùng/);
    expect(() => assertCashRange("2026-10-22", "2026-10-21")).toThrow();
  });
  it("recognizes returns on their own business date and exposes missing cost", () => {
    const order = { _id: "o1", status: "completed", branchId: "b1", businessDate: "2026-10-01", orderCode: "DH1", subtotal: 200, orderDiscount: 20, items: [{ productId: "p1", sku: "SKU", productName: "Máy", quantity: 2, lineTotal: 200, unitCost: 60 }] };
    const returned = { _id: "r1", type: "return", orderId: "o1", branchId: "b1", businessDate: "2026-10-21", code: "TH1", items: [{ orderLineIndex: 0, quantity: 1, lineAmount: 90, unitCost: 60, sku: "SKU", productName: "Máy" }] };
    expect(buildProfitLines([order], [returned], "2026-10-21", "2026-10-21")).toMatchObject([{ quantity: -1, revenue: -90, cost: -60, grossProfit: -30 }]);
    expect(buildProfitLines([{ ...order, items: [{ ...order.items[0], unitCost: 0 }] }], [], "2026-10-01", "2026-10-01")[0]).toMatchObject({ cost: null, warning: "Thiếu giá vốn" });
    const cancelled = { ...order, status: "cancelled", cancelledAt: new Date("2026-10-22T02:00:00Z") };
    expect(buildProfitLines([cancelled], [returned], "2026-10-22", "2026-10-22")).toMatchObject([{ quantity: -1, revenue: -90, cost: -60, grossProfit: -30 }]);
  });
  it("calculates commission only from the permitted base", () => {
    expect(commissionAmount(80_000, 5)).toBe(4_000);
    expect(commissionAmount(-10_000, 5)).toBe(0);
  });
});
