import { describe, expect, it } from "vitest";
import { GoodsReceiptModel } from "./goods-receipt.model";
import { SerialUnitModel } from "../modules/inventory/serials/serial-unit.model";

const receipt = {
  companyCode: "ACME", branchId: "branch-1", warehouseId: "warehouse-1", receiptCode: "PN-RETURN-1",
  supplierName: "Retail customer", createdBy: "manager-1", status: "confirmed",
  items: [{ productId: "product-1", variantId: "variant-1", sku: "PHONE-1", productName: "Phone", quantity: 1, unitCost: 100, lineTotal: 100 }],
};

describe("retail stock receipts", () => {
  it.each(["sales_return", "buyback", "sales_cancel"])("accepts %s without requiring a supplier", (receiptKind) => {
    const doc = new GoodsReceiptModel({ ...receipt, receiptKind, sourceId: "after-sale-1", sourceCode: "RT-1", orderId: "order-1", orderCode: "DH-1", customerId: "customer-1", customerName: "Customer" });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.toObject()).toMatchObject({ receiptKind, sourceId: "after-sale-1", orderId: "order-1", customerId: "customer-1" });
  });

  it("continues to require a supplier on purchase receipts", () => {
    const doc = new GoodsReceiptModel(receipt);
    expect(doc.receiptKind).toBe("purchase");
    expect(doc.validateSync()?.errors.supplierId).toBeDefined();
  });

  it("allows an explicit legacy product reference while requiring an identity on other items", () => {
    const legacyItem = { ...receipt.items[0], variantId: undefined, legacyProductId: "legacy-1" };
    const valid = new GoodsReceiptModel({ ...receipt, receiptKind: "sales_return", items: [legacyItem] });
    expect(valid.validateSync()).toBeUndefined();
    expect(valid.items[0].legacyProductId).toBe("legacy-1");
    const invalid = new GoodsReceiptModel({ ...receipt, receiptKind: "sales_return", items: [{ ...legacyItem, legacyProductId: undefined }] });
    expect(invalid.validateSync()?.errors["items.0.variantId"]).toBeDefined();
  });

  it("preserves barcode aliases and both IMEIs in receipt and serial records", () => {
    const identity = { internalBarcode: "UNIT-1", barcodeAliases: ["ALIAS-1"], serialNumber: "SERIAL-1", imei1: "111", imei2: "222" };
    const doc = new GoodsReceiptModel({ ...receipt, receiptKind: "sales_return", items: [{ ...receipt.items[0], unitDetails: [identity] }] });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.items[0].unitDetails[0]).toMatchObject(identity);
    const unit = new SerialUnitModel({ companyCode: "ACME", branchId: "branch-1", productId: "product-1", sku: "PHONE-1", productName: "Phone", ...identity, normalizedInternalBarcode: "UNIT-1", normalizedSerialNumber: "SERIAL-1", normalizedBarcodeAliases: ["ALIAS-1"], normalizedImeis: ["111", "222"], createdBy: "manager-1", updatedBy: "manager-1" });
    expect(unit.validateSync()).toBeUndefined();
    expect(unit.toObject()).toMatchObject({ ...identity, normalizedBarcodeAliases: ["ALIAS-1"], normalizedImeis: ["111", "222"] });
  });
});
