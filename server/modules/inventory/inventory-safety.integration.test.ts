import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BranchModel } from "../../model/branch.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { InventoryCountModel } from "../../model/inventory-count.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { crudService } from "../../service/crud.service";
import { createCount } from "./counting/inventory-count.service";
import { getSerialHistory, getSerialUnit, registerSerialUnit, transitionSerialUnit } from "./serials/serial-unit.service";
import { SupplierModel } from "../../model/supplier.model";
import { GoodsReceiptModel } from "../../model/goods-receipt.model";
import { createReceipt, submitReceipt, startReceiving, confirmReceipt } from "./receiving/receiving.service";
import { ProductModel } from "../../model/product.model";
import { transferSerialUnit } from "./serials/serial-unit.service";
import { warehouseController } from "./warehouse/warehouse.controller";

const companyCode = "INVENTORYSAFETY";
const branchId = new mongoose.Types.ObjectId().toString();
const warehouseId = new mongoose.Types.ObjectId().toString();
const secondaryWarehouseId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const quantityVariantId = new mongoose.Types.ObjectId().toString();
const serialVariantId = new mongoose.Types.ObjectId().toString();
const scope = { companyCode, branchId };
const actor = { id: "tester", name: "Tester" };
let replSet: MongoMemoryReplSet;

const models = [BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, InventoryBalanceModel,
  InventoryLedgerEntryModel, StockLogModel, SerialUnitModel, SerialEventModel, InventoryCountModel, SupplierModel, GoodsReceiptModel, ProductModel];

async function balance(variantId: string, warehouse = warehouseId) {
  return InventoryBalanceModel.findOne({ companyCode, warehouseId: warehouse, variantId }).lean();
}

function logInput(overrides: any = {}) {
  return { type: "xuất", purpose: "nội bộ", title: "Xuất kho", operatorName: "Tester", status: "Hoàn thành", warehouseId,
    items: [{ productId, variantId: quantityVariantId, sku: "BULK", quantity: 1 }], ...overrides };
}

describe("inventory write safety", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all(models.map((model: any) => model.init()));
  });
  beforeEach(async () => {
    await Promise.all(models.map((model: any) => model.deleteMany({})));
    await BranchModel.create({ _id: branchId, companyCode, code: "TEST", name: "Test", isActive: true });
    await WarehouseModel.create([
      { _id: warehouseId, companyCode, branchId, code: "MAIN", name: "Main", isDefault: true, isActive: true },
      { _id: secondaryWarehouseId, companyCode, branchId, code: "SECONDARY", name: "Secondary", isDefault: false, isActive: true },
    ]);
    await ProductCatalogModel.create({ _id: productId, companyCode, productCode: "P-1", name: "Test product", normalizedName: "test product", productType: "physical", categoryCode: "GENERAL", baseUnitCode: "PCS", status: "active", createdBy: "test", updatedBy: "test" });
    await ProductVariantModel.create([
      { _id: quantityVariantId, companyCode, productId, sku: "BULK", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" },
      { _id: serialVariantId, companyCode, productId, sku: "SERIAL", unitCode: "PCS", trackingMode: "serial", status: "active", createdBy: "test", updatedBy: "test" },
    ]);
    await InventoryBalanceModel.create([
      { companyCode, branchId, warehouseId, productId, variantId: quantityVariantId, sku: "BULK", quantity: 5, averageCost: 20 },
      { companyCode, branchId, warehouseId: secondaryWarehouseId, productId, variantId: quantityVariantId, sku: "BULK", quantity: 4, averageCost: 30 },
      { companyCode, branchId, warehouseId, productId, variantId: serialVariantId, sku: "SERIAL", quantity: 2, averageCost: 50 },
    ]);
    await SerialUnitModel.create(["IMEI-1", "IMEI-2"].map((serialNumber) => ({ ...scope, warehouseId, productId, variantId: serialVariantId,
      sku: "SERIAL", productName: "Test product", serialNumber, normalizedSerialNumber: serialNumber, internalBarcode: `BC-${serialNumber}`,
      normalizedInternalBarcode: `BC-${serialNumber}`, status: "in_stock" as const, createdBy: "test", updatedBy: "test" })));
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("confirms a draft in its original warehouse with its existing lines", async () => {
    const draft: any = await crudService.create("stock-logs", logInput({ status: "Đang chờ", warehouseId: secondaryWarehouseId }), companyCode, branchId);
    await crudService.update("stock-logs", String(draft._id), { status: "Hoàn thành" }, companyCode, "admin", branchId);
    expect((await balance(quantityVariantId, secondaryWarehouseId))?.quantity).toBe(3);
    expect((await balance(quantityVariantId))?.quantity).toBe(5);
    expect((await StockLogModel.findById(draft._id).lean())?.items[0].unitCost).toBe(30);
  });

  it("exposes SKU tracking mode with warehouse balances for generic forms", async () => {
    let payload: any;
    const response: any = { json: (body: any) => { payload = body; return response; }, status: () => response };
    await warehouseController.balances({ user: scope, query: { warehouseId } } as any, response);
    expect(payload.status).toBe("success");
    expect(payload.data.find((item: any) => item.variantId === quantityVariantId).trackingMode).toBe("quantity");
    expect(payload.data.find((item: any) => item.variantId === serialVariantId).trackingMode).toBe("serial");
  });

  it("rolls back stock and ledger if a tracked line has no unit identifiers", async () => {
    await expect(crudService.create("stock-logs", logInput({ items: [{ productId, variantId: serialVariantId, sku: "SERIAL", quantity: 1 }] }), companyCode, branchId)).rejects.toMatchObject({ statusCode: 400 });
    expect((await balance(serialVariantId))?.quantity).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(0);
    expect(await StockLogModel.countDocuments({})).toBe(0);
  });

  it("issues the selected serial once and prevents edits/deletion of posted logs", async () => {
    const input = logInput({ items: [{ productId, variantId: serialVariantId, sku: "SERIAL", quantity: 1, unitIdentifiers: ["BC-IMEI-1"] }] });
    const posted: any = await crudService.create("stock-logs", input, companyCode, branchId);
    expect((await balance(serialVariantId))?.quantity).toBe(1);
    expect((await SerialUnitModel.findOne({ serialNumber: "IMEI-1" }).lean())?.status).toBe("sold");
    await expect(crudService.create("stock-logs", input, companyCode, branchId)).rejects.toMatchObject({ statusCode: 409 });
    await expect(crudService.update("stock-logs", String(posted._id), { status: "Đang chờ" }, companyCode, "admin", branchId)).rejects.toMatchObject({ statusCode: 409 });
    await expect(crudService.delete("stock-logs", String(posted._id), companyCode, "admin", branchId)).rejects.toMatchObject({ statusCode: 409 });
    await crudService.update("stock-logs", String(posted._id), { notes: "Ghi chú" }, companyCode, "admin", branchId);
    expect((await balance(serialVariantId))?.quantity).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(1);
    expect(await SerialEventModel.countDocuments({})).toBe(1);
  });

  it("rejects a product or SKU from outside the selected product/company", async () => {
    await expect(crudService.create("stock-logs", logInput({ items: [{ productId: new mongoose.Types.ObjectId().toString(), sku: "FORGED", quantity: 1 }] }), companyCode, branchId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(crudService.create("stock-logs", logInput({ items: [{ productId, variantId: serialVariantId, sku: "BULK", quantity: 1 }] }), companyCode, branchId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(crudService.create("stock-logs", logInput({ items: [{ productId, sku: "UNKNOWN-SKU", quantity: 1 }] }), companyCode, branchId)).rejects.toMatchObject({ statusCode: 400 });
    expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(0);
  });

  it("rejects update operators and requires stock transfers to use a receiving document", async () => {
    const draft: any = await crudService.create("stock-logs", logInput({ status: "Đang chờ" }), companyCode, branchId);
    await expect(crudService.update("stock-logs", String(draft._id), { $set: { status: "Hoàn thành" } }, companyCode, "admin", branchId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(crudService.create("stock-logs", logInput({ purpose: "chuyển kho" }), companyCode, branchId)).rejects.toMatchObject({ statusCode: 409 });
    expect((await balance(quantityVariantId))?.quantity).toBe(5);
    expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(0);
  });

  it("uses the default completed status without creating a log that skipped stock posting", async () => {
    const input = logInput(); delete input.status;
    const posted: any = await crudService.create("stock-logs", input, companyCode, branchId);
    expect(posted.status).toBe("Thành công");
    expect((await balance(quantityVariantId))?.quantity).toBe(4);
    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: String(posted._id) })).toBe(1);
  });

  it("keeps legacy product stock and the warehouse balance in sync", async () => {
    const legacy = await ProductModel.create({ ...scope, sku: "LEGACY", name: "Legacy product", category: "GENERAL", stock: 5, price: 100, costPrice: 30 });
    const pending: any = await crudService.create("stock-logs", logInput({ status: "Đang chờ", items: [{ productId: String(legacy._id), sku: "LEGACY", quantity: 1 }] }), companyCode, branchId);
    await crudService.update("stock-logs", String(pending._id), { status: "Hoàn thành" }, companyCode, "admin", branchId);
    expect((await ProductModel.findById(legacy._id).lean())?.stock).toBe(4);
    expect((await InventoryBalanceModel.findOne({ productId: String(legacy._id), warehouseId }).lean())?.quantity).toBe(4);
  });

  it("does not copy the legacy branch total into every newly used warehouse", async () => {
    const legacy = await ProductModel.create({ ...scope, sku: "LEGACY", name: "Legacy product", category: "GENERAL", stock: 5, price: 100, costPrice: 30 });
    const items = [{ productId: String(legacy._id), sku: "LEGACY", quantity: 1 }];
    await expect(crudService.create("stock-logs", logInput({ items, warehouseId: secondaryWarehouseId }), companyCode, branchId)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await crudService.create("stock-logs", logInput({ type: "nhập", items, warehouseId: secondaryWarehouseId }), companyCode, branchId);
    await crudService.create("stock-logs", logInput({ items }), companyCode, branchId);
    expect((await ProductModel.findById(legacy._id).lean())?.stock).toBe(5);
    expect((await InventoryBalanceModel.findOne({ productId: String(legacy._id), warehouseId }).lean())?.quantity).toBe(4);
    expect((await InventoryBalanceModel.findOne({ productId: String(legacy._id), warehouseId: secondaryWarehouseId }).lean())?.quantity).toBe(1);
  });

  it("does not let a serial registration payload override tenant, branch, or status", async () => {
    await InventoryBalanceModel.updateOne({ companyCode, warehouseId, variantId: serialVariantId }, { $set: { quantity: 3 } });
    const unit = await registerSerialUnit(scope, { productId, variantId: serialVariantId, sku: "SERIAL", productName: "Test product",
      serialNumber: "NEW-IMEI", companyCode: "OTHER", branchId: "OTHER", status: "sold" } as any, actor);
    expect(unit).toMatchObject({ companyCode, branchId, warehouseId, status: "in_stock" });
    expect(await SerialUnitModel.countDocuments({ companyCode: "OTHER" })).toBe(0);
    expect(await SerialEventModel.countDocuments({ companyCode, serialUnitId: String(unit._id) })).toBe(1);
    await expect(registerSerialUnit(scope, { productId, sku: "SERIAL", productName: "Test product", serialNumber: "BAD-WAREHOUSE", warehouseId: new mongoose.Types.ObjectId().toString() }, actor)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not register more saleable serials than confirmed warehouse stock", async () => {
    await expect(registerSerialUnit(scope, { productId, variantId: serialVariantId, sku: "SERIAL", productName: "Test product", serialNumber: "EXCESS-IMEI" }, actor)).rejects.toMatchObject({ code: "SERIAL_STOCK_NOT_RECEIVED" });
    expect(await SerialUnitModel.countDocuments({ companyCode, status: "in_stock" })).toBe(2);
    expect((await balance(serialVariantId))?.quantity).toBe(2);
  });

  it("looks up serials by document ID and keeps reads scoped to the owning branch", async () => {
    const unit = await SerialUnitModel.findOne({ serialNumber: "IMEI-1" }).lean();
    expect((await getSerialUnit(scope, String(unit!._id))).serialNumber).toBe("IMEI-1");
    await expect(getSerialUnit({ ...scope, branchId: "other" }, String(unit!._id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(getSerialHistory({ ...scope, companyCode: "OTHER" }, String(unit!._id))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("adjusts balance and preserves cost when a lost serial is recovered", async () => {
    const unit = await SerialUnitModel.findOne({ serialNumber: "IMEI-1" }).lean();
    const id = String(unit!._id);
    await transitionSerialUnit(scope, id, { toStatus: "lost", eventType: "lost", reason: "Không tìm thấy" }, actor);
    expect((await balance(serialVariantId))?.quantity).toBe(1);
    await transitionSerialUnit(scope, id, { toStatus: "in_stock", eventType: "recovered", reason: "Đã tìm lại" }, actor);
    expect(await balance(serialVariantId)).toMatchObject({ quantity: 2, averageCost: 50 });
    await expect(transitionSerialUnit(scope, id, { toStatus: "sold", eventType: "sold", reason: "Bypass" }, actor)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires the receiving branch to confirm a cross-branch serial transfer", async () => {
    const unit = await SerialUnitModel.findOne({ serialNumber: "IMEI-1" }).lean();
    await expect(transferSerialUnit(scope, String(unit!._id), { toBranchId: "another-branch", reason: "Move" }, actor)).rejects.toMatchObject({ code: "SERIAL_TRANSFER_RECEIPT_REQUIRED" });
    expect((await SerialUnitModel.findById(unit!._id).lean())?.status).toBe("in_stock");
    expect((await balance(serialVariantId))?.quantity).toBe(2);
  });

  it("does not create a count for a missing warehouse or another branch", async () => {
    await expect(createCount(scope, new mongoose.Types.ObjectId().toString(), actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(createCount({ ...scope, branchId: "other" }, warehouseId, actor)).rejects.toMatchObject({ statusCode: 404 });
    expect(await InventoryCountModel.countDocuments({})).toBe(0);
  });

  it("receives a serial purchase exactly once and rolls back a duplicate serial receipt", async () => {
    const supplier = await SupplierModel.create({ companyCode, code: "NCC", name: "Supplier", status: "active", createdBy: "test", updatedBy: "test" });
    const receive = async (serialNumber: string) => {
      const draft = await createReceipt(scope, { supplierId: String(supplier._id), warehouseId,
        items: [{ productId, variantId: serialVariantId, quantity: 1, unitCost: 80, serialNumbers: [serialNumber] }],
      }, actor);
      await submitReceipt(scope, String(draft._id), actor);
      await startReceiving(scope, String(draft._id), actor);
      return String(draft._id);
    };
    const id = await receive("PURCHASE-IMEI");
    await confirmReceipt(scope, id, actor);
    await confirmReceipt(scope, id, actor);
    expect((await balance(serialVariantId))?.quantity).toBe(3);
    expect(await SerialUnitModel.countDocuments({ companyCode, normalizedSerialNumber: "PURCHASE-IMEI" })).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: id })).toBe(1);
    const duplicateId = await receive("PURCHASE-IMEI");
    await expect(confirmReceipt(scope, duplicateId, actor)).rejects.toMatchObject({ code: "UNIT_ID_DUPLICATE" });
    expect((await balance(serialVariantId))?.quantity).toBe(3);
    expect((await GoodsReceiptModel.findById(duplicateId).lean())?.status).toBe("receiving");
    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: duplicateId })).toBe(0);
  });
});
