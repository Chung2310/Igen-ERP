import { describe, expect, it } from "vitest";
import type { RetailCartState } from "./retailCart";
import * as inputModule from "./retailOrderInput";

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };

describe("retail order input", () => {
  it("builds one authoritative payload for quote, draft and checkout", () => {
    const buildRetailOrderInput = (inputModule as any).buildRetailOrderInput;
    expect(typeof buildRetailOrderInput).toBe("function");
    const cart: RetailCartState = {
      lines: [{ product, quantity: 2, discount: { type: "percent", value: 10 } }],
      customer: { _id: "c1", customerCode: "KH-1", companyCode: "ACME", originBranchId: "B1", name: "An" },
      orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
      quote: null, quoteDirty: true,
    };
    expect(buildRetailOrderInput(cart)).toEqual({
      items: [{ productId: "p1", quantity: 2, discount: { type: "percent", value: 10 } }],
      customerId: "c1", orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
    });
  });

  it("omits customer id for walk-in sales", () => {
    const cart: RetailCartState = { lines: [], customer: null, orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, quote: null, quoteDirty: false };
    expect((inputModule as any).buildRetailOrderInput(cart)).toEqual({ items: [], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0 });
  });
});
