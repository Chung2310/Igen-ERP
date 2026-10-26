// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { initialRetailCart } from "../hooks/retailCart";
import { discardPosCart, readPosCart, savePosCart } from "./posCartRecovery";

const key = "retail-pos-cart:test";
const product = { _id: "p1", sku: "SKU-1", name: "Điện thoại", category: "PHONE", unit: "cái", stock: 2, price: 10_000 };

afterEach(() => localStorage.clear());

describe("retail POS cart recovery", () => {
  it("restores a valid cart without trusting its old quote", () => {
    const cart = {
      ...initialRetailCart,
      lines: [{ product, quantity: 1, discount: { type: "amount" as const, value: 0 }, serialNumbers: ["IMEI-1"] }],
      customer: null,
      quote: { subtotal: 10_000, grandTotal: 1 },
      quoteDirty: false,
    };
    savePosCart(key, cart);

    const recovered = readPosCart(key);

    expect(recovered.error).toBeUndefined();
    expect(recovered.cart.lines).toEqual(cart.lines);
    expect(recovered.cart.quote).toBeNull();
    expect(recovered.cart.quoteDirty).toBe(true);
  });

  it("keeps malformed data for review until it is explicitly discarded", () => {
    localStorage.setItem(key, JSON.stringify({ version: 1, cart: { lines: [{ quantity: 0 }] } }));

    expect(readPosCart(key).error).toMatch(/không đọc được/i);
    expect(localStorage.getItem(key)).not.toBeNull();
    discardPosCart(key);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
