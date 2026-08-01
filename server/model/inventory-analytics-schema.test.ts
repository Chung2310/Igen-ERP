import { describe, expect, it } from "vitest";
import { ProductModel } from "./product.model";
import { StockLogModel } from "./stock-log.model";

describe("inventory analytics schema", () => {
  it("stores immutable price snapshots on stock-log lines", () => {
    expect(StockLogModel.schema.path("items.unitPrice")).toBeDefined();
    expect(StockLogModel.schema.path("items.lineTotal")).toBeDefined();
    expect(StockLogModel.schema.path("items.unitCost")).toBeDefined();
    expect(ProductModel.schema.path("costPrice")).toBeDefined();
  });

  it("keeps legacy stock-log purpose unclassified instead of inventing history", () => {
    const purpose = StockLogModel.schema.path("purpose") as any;
    expect(purpose.options.default).toBeUndefined();
    expect(purpose.enumValues).toEqual(["bán", "nội bộ", "hủy", "chuyển kho"]);
  });

  it("rejects negative prices", async () => {
    const product = new ProductModel({
      sku: "SKU-1",
      name: "Test",
      category: "Test",
      unit: "cái",
      price: 10,
      costPrice: -1,
      companyCode: "COMPANY",
    });
    await expect(product.validate()).rejects.toThrow(/costPrice/);
  });
});
