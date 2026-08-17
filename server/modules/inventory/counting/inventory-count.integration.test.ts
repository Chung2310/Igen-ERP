import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryCountModel } from "../../../model/inventory-count.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { approveCount } from "./inventory-count.service";

const companyCode = "TEST";
const branchId = "branch-1";
const warehouseId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const variantId = new mongoose.Types.ObjectId().toString();
const scope = { companyCode, branchId };
let replSet: MongoMemoryReplSet;

async function seedCount(quantityDelta = 2, sourceBalanceVersion = 0) {
  await WarehouseModel.create({ _id: warehouseId, companyCode, branchId, code: "TEST", name: "Test warehouse", kind: "selling", isDefault: true, isActive: true });
  await ProductCatalogModel.create({ _id: productId, companyCode, productCode: "P-1", name: "Test product", normalizedName: "test product", productType: "physical", categoryCode: "GENERAL", baseUnitCode: "PCS", status: "active", createdBy: "test", updatedBy: "test" });
  await ProductVariantModel.create({ _id: variantId, companyCode, productId, sku: "SKU-1", barcode: "8930000000001", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" });
  const balance = await InventoryBalanceModel.create({ companyCode, branchId, warehouseId, productId, variantId, sku: "SKU-1", quantity: 10, reservedQuantity: 0, averageCost: 5, version: 0 });
  return InventoryCountModel.create({ companyCode, branchId, warehouseId, countCode: "KK-1", status: "pending_approval", createdBy: "test", items: [{ productId, variantId, sku: "SKU-1", barcode: "8930000000001", productName: "Test product", systemQuantity: 10, countedQuantity: 10 + quantityDelta, quantityDelta, sourceBalanceVersion, note: "" }] });
}

describe("inventory count approval integration", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => { await Promise.all([InventoryLedgerEntryModel.deleteMany({}), InventoryCountModel.deleteMany({}), InventoryBalanceModel.deleteMany({}), ProductVariantModel.deleteMany({}), ProductCatalogModel.deleteMany({}), WarehouseModel.deleteMany({})]); });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("writes the signed adjustment and is not replayable after completion", async () => {
    const count: any = await seedCount(2);
    const completed: any = await approveCount(scope, String(count._id), { id: "approver" });
    expect(completed.status).toBe("completed");
    expect((await InventoryBalanceModel.findOne({ warehouseId, productId, variantId }).lean())?.quantity).toBe(12);
    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: String(count._id) })).toBe(1);
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toThrow();
    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: String(count._id) })).toBe(1);
  });

  it("marks the count as conflict when the captured balance version is stale", async () => {
    const count: any = await seedCount(2, 99);
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("conflict");
  });
});
