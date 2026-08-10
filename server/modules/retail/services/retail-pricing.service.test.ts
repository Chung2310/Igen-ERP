import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderTotals } from "./retail-pricing.service";

const line = (overrides: Record<string, unknown> = {}) => ({ productId: "P1", sku: "SKU1", productName: "Sản phẩm", unit: "Cái", category: "A", quantity: 2, unitPrice: 100_000, unitCost: 60_000, ...overrides });

test("calculates authoritative integer VND totals in the fixed order", () => {
  const result = calculateOrderTotals({ items: [line()], orderDiscount: { type: "amount", value: 10_000 }, taxRate: 8.5, shippingFee: 5_000, maxDiscountPercent: 20 });
  assert.equal(result.subtotal, 200_000);
  assert.equal(result.orderDiscount, 10_000);
  assert.equal(result.taxAmount, 16_150);
  assert.equal(result.grandTotal, 211_150);
  assert.equal(result.totalCost, 120_000);
});

test("supports percent and amount discounts at both levels", () => {
  const percent = calculateOrderTotals({ items: [line({ discount: { type: "percent", value: 10 } })], orderDiscount: { type: "percent", value: 10 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 20 });
  assert.equal(percent.lines[0].discountAmount, 20_000);
  assert.equal(percent.orderDiscount, 18_000);
  assert.equal(percent.grandTotal, 162_000);
  const amount = calculateOrderTotals({ items: [line({ discount: { type: "amount", value: 20_000 } })], orderDiscount: { type: "amount", value: 18_000 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 20 });
  assert.equal(amount.grandTotal, percent.grandTotal);
});

test("rounds each percentage discount and tax to integer VND", () => {
  const result = calculateOrderTotals({ items: [line({ quantity: 3, unitPrice: 3_333, discount: { type: "percent", value: 8.5 } })], orderDiscount: { type: "amount", value: 0 }, taxRate: 8.5, shippingFee: 0, maxDiscountPercent: 20 });
  assert.equal(result.lines[0].discountAmount, 850);
  assert.equal(result.lines[0].lineTotal, 9_149);
  assert.equal(result.taxAmount, 778);
});

test("combined line and order discount cannot exceed branch cap", () => {
  assert.throws(() => calculateOrderTotals({ items: [line({ discount: { type: "percent", value: 10 } })], orderDiscount: { type: "percent", value: 11.12 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 20 }), /hạn mức/i);
});

test("rejects discounts greater than their base", () => {
  assert.throws(() => calculateOrderTotals({ items: [line({ discount: { type: "amount", value: 200_001 } })], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 100 }));
  assert.throws(() => calculateOrderTotals({ items: [line()], orderDiscount: { type: "amount", value: 200_001 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 100 }));
});

for (const [name, overrides] of [
  ["zero quantity", { items: [line({ quantity: 0 })] }],
  ["fractional quantity", { items: [line({ quantity: 1.5 })] }],
  ["negative price", { items: [line({ unitPrice: -1 })] }],
  ["negative cost", { items: [line({ unitCost: -1 })] }],
  ["negative shipping", { shippingFee: -1 }],
  ["tax over 100", { taxRate: 100.01 }],
  ["tax precision over two decimals", { taxRate: 8.555 }],
  ["negative cap", { maxDiscountPercent: -1 }],
] as const) {
  test(`rejects ${name}`, () => {
    assert.throws(() => calculateOrderTotals({ items: [line()], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 100, ...overrides } as any));
  });
}

test("requires at least one item", () => {
  assert.throws(() => calculateOrderTotals({ items: [], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: 0 }));
});
