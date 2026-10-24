import { describe, expect, it } from "vitest";
import { selectedItems } from "./retail-after-sale.service";

const order = {
  subtotal: 200_000, grandTotal: 200_000, shippingFee: 0,
  items: [{ productId: "sku-1", sku: "SKU-1", productName: "Máy A", trackingMode: "quantity", quantity: 2, lineTotal: 200_000, unitCost: 50_000 }],
};

describe("giới hạn số lượng trả và thu mua", () => {
  it("không cho tách cùng dòng thành hai mục để vượt số lượng đơn gốc", () => {
    const input = { type: "return", items: [{ orderLineIndex: 0, quantity: 2 }, { orderLineIndex: 0, quantity: 1 }] };
    expect(() => selectedItems(order, input, new Map())).toThrow("vượt quá số còn có thể xử lý");
  });

  it("trừ số lượng đã xử lý trước và giữ số lượng của từng mục trong cùng yêu cầu", () => {
    const used = new Map([[0, 1]]);
    expect(selectedItems(order, { type: "return", items: [{ orderLineIndex: 0, quantity: 1 }] }, used)).toHaveLength(1);
    expect(used.get(0)).toBe(2);
  });

  it("từ chối chỉ số dòng không nguyên", () => {
    expect(() => selectedItems(order, { type: "buyback", items: [{ orderLineIndex: 0.5, quantity: 1, unitAmount: 100_000 }] }, new Map())).toThrow("không thuộc đơn bán gốc");
  });
});
