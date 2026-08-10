import { describe, expect, it } from "vitest";
import { retailCartReducer, type RetailCartState } from "./retailCart";

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "Cái", stock: 10, price: 100_000 };
const empty: RetailCartState = { lines: [], quote: null, quoteDirty: false };

describe("retail cart", () => {
  it("increases quantity when the same barcode is scanned repeatedly", () => {
    const once = retailCartReducer(empty, { type: "add", product });
    const twice = retailCartReducer(once, { type: "add", product });
    expect(twice.lines).toEqual([{ product, quantity: 2 }]);
    expect(twice.quoteDirty).toBe(true);
  });

  it("removes a line when quantity becomes zero", () => {
    const state = retailCartReducer({ ...empty, lines: [{ product, quantity: 1 }] }, { type: "quantity", productId: "p1", quantity: 0 });
    expect(state.lines).toEqual([]);
  });

  it("accepts only the latest authoritative quote", () => {
    const quote = { grandTotal: 100_000, subtotal: 100_000 };
    const state = retailCartReducer(empty, { type: "quote", quote });
    expect(state.quote).toEqual(quote);
    expect(state.quoteDirty).toBe(false);
  });

  it("loads a held draft as an editable cart", () => {
    const state = retailCartReducer(empty, { type: "load", lines: [{ product, quantity: 3 }] });
    expect(state.lines[0].quantity).toBe(3);
    expect(state.quoteDirty).toBe(true);
  });
});
