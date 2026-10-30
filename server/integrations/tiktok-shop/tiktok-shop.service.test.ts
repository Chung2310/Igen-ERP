import { describe, expect, it } from "vitest";
import { allocateTikTokInventory, missingTikTokProductInfo } from "./tiktok-shop.service";

describe("TikTok Shop inventory allocation", () => {
  it("puts all available stock in the only TikTok warehouse", () => {
    expect(allocateTikTokInventory(12, [{ warehouseId: "WH-1", quantity: 3 }])).toEqual([
      { warehouse_id: "WH-1", quantity: 12 },
    ]);
  });

  it("preserves the existing warehouse ratio and exact total", () => {
    expect(allocateTikTokInventory(11, [
      { warehouseId: "WH-1", quantity: 3 },
      { warehouseId: "WH-2", quantity: 1 },
    ])).toEqual([
      { warehouse_id: "WH-1", quantity: 8 },
      { warehouse_id: "WH-2", quantity: 3 },
    ]);
  });

  it("requires a warehouse configured on TikTok", () => {
    expect(() => allocateTikTokInventory(1, [])).toThrow(/chưa có kho hàng/i);
  });
});

describe("TikTok Shop product detail completeness", () => {
  it("accepts existing products when product and every SKU have the required sync data", () => {
    expect(missingTikTokProductInfo({
      description: "<p>Phone</p>",
      categoryId: "cat-1",
      imageUrls: ["https://example.com/phone.jpg"],
      skus: [{ skuId: "sku-1", priceAmount: "1000000", currency: "VND", hasInventorySnapshot: true }],
    })).toEqual([]);
  });

  it("reports missing product and SKU fields for already-synced products", () => {
    expect(missingTikTokProductInfo({
      description: "<p>  </p>",
      imageUrls: [],
      skus: [{ skuId: "sku-1", priceAmount: "", currency: "", hasInventorySnapshot: false }],
    })).toEqual(["Mô tả", "Danh mục", "Ảnh sản phẩm", "Giá SKU", "Tồn kho SKU"]);
  });
});
