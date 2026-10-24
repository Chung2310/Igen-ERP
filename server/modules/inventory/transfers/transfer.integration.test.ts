import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BranchModel } from "../../../model/branch.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../../model/stock-log.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { InventoryTransferModel } from "./transfer.model";
import { InventoryStockReversalModel } from "./stock-reversal.model";
import { cancelInventoryTransfer, receiveInventoryTransfer, requestInventoryTransfer, reverseInventoryTransfer } from "./transfer.service";
import { reconcileWarehouse } from "./reconciliation.service";

const companyCode = "TRANSFERTEST";
const fromBranchId = new mongoose.Types.ObjectId().toString();
const toBranchId = new mongoose.Types.ObjectId().toString();
const fromWarehouseId = new mongoose.Types.ObjectId().toString();
const toWarehouseId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const serialVariantId = new mongoose.Types.ObjectId().toString();
const quantityVariantId = new mongoose.Types.ObjectId().toString();
const actor = { id: "tester", name: "Nhân viên thử nghiệm" };
let replSet: MongoMemoryReplSet;

async function quantity(warehouseId: string, variantId: string) {
  return Number((await InventoryBalanceModel.findOne({ companyCode, warehouseId, variantId }).lean())?.quantity || 0);
}
async function seed() {
  await BranchModel.create([
    { _id: fromBranchId, companyCode, code: "GUI", name: "Chi nhánh gửi", isActive: true },
    { _id: toBranchId, companyCode, code: "NHAN", name: "Chi nhánh nhận", isActive: true },
  ]);
  await WarehouseModel.create([
    { _id: fromWarehouseId, companyCode, branchId: fromBranchId, code: "KHO-GUI", name: "Kho gửi", isDefault: true, isActive: true },
    { _id: toWarehouseId, companyCode, branchId: toBranchId, code: "KHO-NHAN", name: "Kho nhận", isDefault: true, isActive: true },
  ]);
  await ProductCatalogModel.create({ _id: productId, companyCode, productCode: "P-1", name: "Điện thoại", normalizedName: "dien thoai", productType: "physical", categoryCode: "PHONE", baseUnitCode: "PCS", status: "active", createdBy: "test", updatedBy: "test" });
  await ProductVariantModel.create([
    { _id: serialVariantId, companyCode, productId, sku: "PHONE-SERIAL", unitCode: "PCS", trackingMode: "serial", status: "active", createdBy: "test", updatedBy: "test" },
    { _id: quantityVariantId, companyCode, productId, sku: "PHONE-BULK", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" },
  ]);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    await writeStockMovement({ companyCode, branchId: fromBranchId, warehouseId: fromWarehouseId, direction: "in", purpose: "opening",
      sourceType: "opening", sourceId: "opening-1", idempotencyKey: "opening-1", operatorName: actor.name, session,
      items: [
        { productId, variantId: serialVariantId, sku: "PHONE-SERIAL", productName: "Điện thoại", quantity: 3, unitCost: 100 },
        { productId, variantId: quantityVariantId, sku: "PHONE-BULK", productName: "Điện thoại", quantity: 5, unitCost: 50 },
      ] });
  }); } finally { await session.endSession(); }
  await SerialUnitModel.insertMany(["IMEI-001", "IMEI-002", "IMEI-003"].map((serialNumber) => ({
    companyCode, branchId: fromBranchId, warehouseId: fromWarehouseId, productId, variantId: serialVariantId, sku: "PHONE-SERIAL",
    productName: "Điện thoại", internalBarcode: serialNumber, normalizedInternalBarcode: serialNumber,
    serialNumber, normalizedSerialNumber: serialNumber, status: "in_stock" as const, createdBy: "test", updatedBy: "test",
  })));
}
const input = () => ({ idempotencyKey: "request-001", fromWarehouseId, toWarehouseId, toBranchId, reason: "Bổ sung tồn chi nhánh", items: [
  { variantId: serialVariantId, quantity: 2, serialNumbers: ["IMEI-001", "IMEI-002"] },
  { variantId: quantityVariantId, quantity: 3 },
] });

describe("điều chuyển kho hai chi nhánh", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([BranchModel.deleteMany({}), WarehouseModel.deleteMany({}), InventoryBalanceModel.deleteMany({}),
      InventoryLedgerEntryModel.deleteMany({}), StockLogModel.deleteMany({}), ProductCatalogModel.deleteMany({}),
      ProductVariantModel.deleteMany({}), SerialUnitModel.deleteMany({}), InventoryTransferModel.deleteMany({}), InventoryStockReversalModel.deleteMany({})]);
    await seed();
  }, 30_000);
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("chuyển nhiều SKU/IMEI, kho nhận xác nhận rồi đảo một lần", async () => {
    const transfer = await requestInventoryTransfer({ companyCode, branchId: fromBranchId }, input(), actor);
    const id = String(transfer._id);
    expect(String((await requestInventoryTransfer({ companyCode, branchId: fromBranchId }, input(), actor))._id)).toBe(id);
    expect(transfer.status).toBe("in_transit");
    expect(await quantity(fromWarehouseId, serialVariantId)).toBe(1);
    expect(await quantity(fromWarehouseId, quantityVariantId)).toBe(2);
    expect(await SerialUnitModel.countDocuments({ companyCode, status: "in_transit", currentDocumentId: id })).toBe(2);
    await expect(receiveInventoryTransfer({ companyCode, branchId: fromBranchId }, id, actor)).rejects.toThrow();
    await receiveInventoryTransfer({ companyCode, branchId: toBranchId }, id, actor);
    expect(await quantity(toWarehouseId, serialVariantId)).toBe(2);
    expect(await quantity(toWarehouseId, quantityVariantId)).toBe(3);
    expect(await SerialUnitModel.countDocuments({ companyCode, branchId: toBranchId, status: "in_stock", currentDocumentId: id })).toBe(2);
    const sourceCheck = await reconcileWarehouse(companyCode, fromBranchId, fromWarehouseId);
    const destinationCheck = await reconcileWarehouse(companyCode, toBranchId, toWarehouseId);
    expect(sourceCheck.differenceCount).toBe(0);
    expect(destinationCheck.differenceCount).toBe(0);
    await reverseInventoryTransfer({ companyCode, branchId: toBranchId }, id, "Nhận nhầm kho", actor);
    expect(await quantity(fromWarehouseId, serialVariantId)).toBe(3);
    expect(await quantity(toWarehouseId, serialVariantId)).toBe(0);
    expect((await reconcileWarehouse(companyCode, fromBranchId, fromWarehouseId)).differenceCount).toBe(0);
    expect((await reconcileWarehouse(companyCode, toBranchId, toWarehouseId)).differenceCount).toBe(0);
    expect(await InventoryStockReversalModel.countDocuments({ companyCode, sourceId: id })).toBe(1);
    await expect(reverseInventoryTransfer({ companyCode, branchId: toBranchId }, id, "Lặp", actor)).rejects.toThrow();
    expect(await InventoryLedgerEntryModel.countDocuments({ companyCode, sourceType: "inventory-transfer-reversal", sourceId: id })).toBe(4);
    await expect(requestInventoryTransfer({ companyCode, branchId: fromBranchId }, { ...input(), reason: "Yêu cầu khác" }, actor)).rejects.toThrow();
  }, 30_000);

  it("hủy phiếu đang chuyển hoàn tồn gửi và từ chối nhận lại", async () => {
    const transfer = await requestInventoryTransfer({ companyCode, branchId: fromBranchId }, input(), actor);
    const id = String(transfer._id);
    await cancelInventoryTransfer({ companyCode, branchId: fromBranchId }, id, "Không cần bổ sung", actor);
    expect(await quantity(fromWarehouseId, serialVariantId)).toBe(3);
    expect(await quantity(fromWarehouseId, quantityVariantId)).toBe(5);
    expect(await SerialUnitModel.countDocuments({ companyCode, branchId: fromBranchId, status: "in_stock" })).toBe(3);
    await expect(receiveInventoryTransfer({ companyCode, branchId: toBranchId }, id, actor)).rejects.toThrow();
  }, 30_000);
});
