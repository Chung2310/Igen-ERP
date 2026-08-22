import { describe, expect, it } from "vitest";
import { retailCartReducer, type RetailCartState } from "./retailCart";

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "Cái", stock: 10, price: 100_000 };
const empty: RetailCartState = { lines: [], customer: null, billingProfile: null, orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, quote: null, quoteDirty: false };

describe("retail cart", () => {
  it("increases quantity when the same barcode is scanned repeatedly", () => {
    const once = retailCartReducer(empty, { type: "add", product });
    const twice = retailCartReducer(once, { type: "add", product });
    expect(twice.lines).toEqual([{ product, quantity: 2, discount: { type: "amount", value: 0 } }]);
    expect(twice.quoteDirty).toBe(true);
  });

  it("removes a line when quantity becomes zero", () => {
    const state = retailCartReducer({ ...empty, lines: [{ product, quantity: 1, discount: { type: "amount", value: 0 } }] }, { type: "quantity", productId: "p1", quantity: 0 });
    expect(state.lines).toEqual([]);
  });

  it("accepts only the latest authoritative quote", () => {
    const quote = { grandTotal: 100_000, subtotal: 100_000 };
    const state = retailCartReducer(empty, { type: "quote", quote });
    expect(state.quote).toEqual(quote);
    expect(state.quoteDirty).toBe(false);
  });

  it("loads a held draft as an editable cart", () => {
    const state = retailCartReducer(empty, { type: "load", lines: [{ product, quantity: 3, discount: { type: "amount", value: 0 } }] });
    expect(state.lines[0].quantity).toBe(3);
    expect(state.quoteDirty).toBe(true);
  });

  it("keeps line and order adjustments while loading a held draft", () => {
    const state = retailCartReducer(empty, {
      type: "load",
      lines: [{ product, quantity: 2, discount: { type: "percent", value: 10 } }],
      orderDiscount: { type: "amount", value: 5_000 },
      taxRate: 8,
      shippingFee: 20_000,
    });

    expect(state.lines[0].discount).toEqual({ type: "percent", value: 10 });
    expect(state.orderDiscount).toEqual({ type: "amount", value: 5_000 });
    expect(state.taxRate).toBe(8);
    expect(state.shippingFee).toBe(20_000);
    expect(state.quoteDirty).toBe(true);
  });

  it("normalizes a negative order discount from a loaded draft", () => {
    const state = retailCartReducer(empty, {
      type: "load",
      lines: [{ product, quantity: 1, discount: { type: "amount", value: 0 } }],
      orderDiscount: { type: "amount", value: -5_000 },
    });

    expect(state.orderDiscount).toEqual({ type: "amount", value: 0 });
  });

  it("marks the quote dirty when editing line and order adjustments", () => {
    const loaded = retailCartReducer(empty, { type: "add", product });
    const quoted = retailCartReducer(loaded, { type: "quote", quote: { subtotal: 100_000, grandTotal: 100_000 } });
    const lineDiscounted = retailCartReducer(quoted, { type: "lineDiscount", productId: "p1", discount: { type: "amount", value: 10_000 } });
    const adjusted = retailCartReducer(lineDiscounted, { type: "orderAdjustments", orderDiscount: { type: "percent", value: 5 }, taxRate: 8, shippingFee: 12_000 });

    expect(adjusted.lines[0].discount).toEqual({ type: "amount", value: 10_000 });
    expect(adjusted.orderDiscount).toEqual({ type: "percent", value: 5 });
    expect(adjusted.taxRate).toBe(8);
    expect(adjusted.shippingFee).toBe(12_000);
    expect(adjusted.quoteDirty).toBe(true);
  });

  it("keeps selected serials on the cart line", () => {
    const state = retailCartReducer({ ...empty, lines: [{ product: { ...product, trackingMode: "serial" }, quantity: 2, discount: { type: "amount", value: 0 } }] }, { type: "serials", productId: "p1", serialNumbers: ["IMEI-1", "IMEI-2"] });
    expect(state.lines[0].serialNumbers).toEqual(["IMEI-1", "IMEI-2"]);
    expect(state.quoteDirty).toBe(true);
  });
});
