import { InventoryTransferModel } from "./transfer.model";
import { createTransfer, acceptTransfer, cancelTransfer, listTransfers, getTransfer, transferDestinations } from "./transfer.service";
import { requestSerialTransfer, acceptSerialTransfer, cancelSerialTransfer } from "../serials/serial-transfer.service";
import { getSerialHistory, listSerialUnits, transferSerialUnit, transitionSerialUnit } from "../serials/serial-unit.service";
import { listWarehouses, getWarehouse } from "../warehouse/warehouse.service";
import { createCount } from "../counting/inventory-count.service";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchModel } from "../../../model/branch.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../../model/stock-log.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { SerialEventModel } from "../serials/serial-event.model";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";

const id = () => new mongoose.Types.ObjectId().toString();
const companyCode = "TRANSFER";
const branchId = id(), warehouseId = id(), otherWarehouseId = id(), productId = id(), variantId = id(), secondVariantId = id();
const scope = { companyCode, branchId };
const targetBranchId = id(), targetWarehouseId = id();
const targetScope = { companyCode, branchId: targetBranchId };
const actor = { id: "tester", name: "Tester" };
const input = (more: any = {}) => ({ fromWarehouseId: warehouseId, toBranchId: targetBranchId, toWarehouseId: targetWarehouseId, reason: "Replenish", idempotencyKey: id(), items: [line()], ...more });
const models = [BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, InventoryBalanceModel, InventoryLedgerEntryModel, StockLogModel, SerialUnitModel, SerialEventModel, GoodsReceiptModel, InventoryTransferModel];
let replica: MongoMemoryReplSet;
const line = (more: any = {}) => ({ productId, variantId, sku: "SKU-A", productName: "Phone", quantity: 1, unitPrice: 200, unitCost: 0, ...more });
async function quantity() { return (await InventoryBalanceModel.findOne({ warehouseId, variantId }).lean())!.quantity; }
async function machine(serial = "IMEI-1", extra: any = {}) {
  await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
  return SerialUnitModel.create({ ...scope, warehouseId, productId, variantId, sku: "SKU-A", productName: "Phone", serialNumber: serial, normalizedSerialNumber: serial, internalBarcode: `BAR-${serial}`, normalizedInternalBarcode: `BAR-${serial}`, status: "in_stock", createdBy: "test", updatedBy: "test", ...extra });
}

describe("transfer document invariants", () => {
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replica.getUri());
    await Promise.all(models.map((model: any) => model.init()));
    // Deployed ERP databases retain these indexes from the earlier transfer model.
    await InventoryTransferModel.collection.createIndex({ companyCode: 1, code: 1 }, { unique: true });
    await InventoryTransferModel.collection.createIndex({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
  }, 60000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(models.map((model: any) => model.deleteMany({})));
    await BranchModel.create({ _id: branchId, companyCode, code: "MAIN", name: "Main", isActive: true });
    await BranchModel.create({ _id: targetBranchId, companyCode, code: "TARGET", name: "Target", isActive: true });
    await WarehouseModel.create({ _id: targetWarehouseId, companyCode, branchId: targetBranchId, code: "TARGET", name: "Target warehouse", isDefault: true, isActive: true });
    await WarehouseModel.create([
      { _id: warehouseId, ...scope, code: "SECONDARY", name: "Secondary", isDefault: false, isActive: true },
      { _id: otherWarehouseId, ...scope, code: "DEFAULT", name: "Default", isDefault: true, isActive: true },
    ]);
    await ProductCatalogModel.create({ _id: productId, companyCode, productCode: "P", name: "Phone", normalizedName: "phone", productType: "physical", categoryCode: "PHONE", baseUnitCode: "PCS", status: "active", createdBy: "test", updatedBy: "test" });
    await ProductVariantModel.create([
      { _id: variantId, companyCode, productId, sku: "SKU-A", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" },
      { _id: secondVariantId, companyCode, productId, sku: "SKU-B", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" },
    ]);
    await InventoryBalanceModel.create({ ...scope, warehouseId, productId, variantId, sku: "SKU-A", quantity: 2, reservedQuantity: 0, averageCost: 100, version: 0 });
  });
  afterAll(async () => { vi.restoreAllMocks(); await mongoose.disconnect(); await replica?.stop(); });

  it("creates multiple Retail transfers with the existing ERP unique indexes", async () => {
    const first = await createTransfer(scope, input(), actor);
    const second = await createTransfer(scope, input(), actor);
    expect(first.code).toBe(first.transferCode);
    expect(second.code).toBe(second.transferCode);
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect(await InventoryTransferModel.countDocuments()).toBe(2);
    expect(await quantity()).toBe(0);
  });

  it("displays and receives ERP transfers that predate the Retail metadata", async () => {
    const documents = [await createTransfer(scope, input(), actor), await createTransfer(scope, input(), actor)];
    for (const [index, document] of documents.entries()) {
      await InventoryTransferModel.collection.updateOne({ _id: document._id }, {
        $set: { code: `ERP-LEGACY-${index}`, version: 0 },
        $unset: { transferCode: "", requestKey: "", fromWarehouseName: "", toWarehouseName: "", createdByName: "", "items.0.trackingMode": "" },
      });
    }
    const listed = await listTransfers(targetScope);
    expect(listed.total).toBe(2);
    expect(listed.items.map((document) => document.transferCode).sort()).toEqual(["ERP-LEGACY-0", "ERP-LEGACY-1"]);
    const detail = await getTransfer(targetScope, String(documents[0]._id));
    expect(detail).toMatchObject({ transferCode: "ERP-LEGACY-0", fromWarehouseName: "Secondary", toWarehouseName: "Target warehouse", createdByName: actor.id });
    await acceptTransfer(targetScope, String(documents[0]._id), actor);
    await acceptTransfer(targetScope, String(documents[0]._id), actor);
    expect(await InventoryTransferModel.findById(documents[0]._id).lean()).toMatchObject({ status: "received", transferCode: "ERP-LEGACY-0" });
    expect(await InventoryBalanceModel.findOne({ warehouseId: targetWarehouseId }).lean()).toMatchObject({ quantity: 1, averageCost: 100 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(6);
  });

  it("offers a new branch without a warehouse and transfers into its own empty stock", async () => {
    await WarehouseModel.deleteOne({ _id: targetWarehouseId });
    const destinations = await transferDestinations(companyCode);
    const target = destinations.find(w => w.branchId === targetBranchId);
    expect(target).toMatchObject({ code: "KHO-TARGET", isDefault: true });
    expect(await InventoryBalanceModel.countDocuments({ branchId: targetBranchId })).toBe(0);
    await transferDestinations(companyCode);
    expect(await WarehouseModel.countDocuments({ companyCode, branchId: targetBranchId })).toBe(1);
    const doc = await createTransfer(scope, input({ toWarehouseId: String(target!._id) }), actor);
    await acceptTransfer(targetScope, String(doc._id), actor);
    expect(await quantity()).toBe(1);
    expect(await InventoryBalanceModel.findOne({ branchId: targetBranchId, warehouseId: String(target!._id), variantId }).lean()).toMatchObject({ productId, variantId, sku: "SKU-A", quantity: 1 });
    // The company catalog is shared; only warehouse balances are branch-local.
    expect(await ProductCatalogModel.countDocuments({ companyCode })).toBe(1);
    expect(await ProductVariantModel.countDocuments({ companyCode, sku: "SKU-A" })).toBe(1);
  });

  it("does not provision other companies, inactive branches or reactivate disabled warehouses", async () => {
    await WarehouseModel.updateOne({ _id: targetWarehouseId }, { isActive: false });
    const inactive = await BranchModel.create({ companyCode, code: "CLOSED", name: "Closed", isActive: false });
    const foreign = await BranchModel.create({ companyCode: "OTHER", code: "MAIN", name: "Other", isActive: true });
    const destinations = await transferDestinations(companyCode);
    expect(destinations.some(w => w.branchId === targetBranchId)).toBe(false);
    expect(await WarehouseModel.countDocuments({ branchId: { $in: [String(inactive._id), String(foreign._id)] } })).toBe(0);
    expect(await WarehouseModel.findById(targetWarehouseId).lean()).toMatchObject({ isActive: false });
  });

  it("conserves quantity and value from source through transit into a different branch", async () => {
    const doc = await createTransfer(scope, input(), actor);
    expect(await quantity()).toBe(1);
    const transit = await InventoryBalanceModel.findOne({ warehouseId: doc.transitWarehouseId }).lean();
    expect(transit).toMatchObject({ quantity: 1, averageCost: 100, reservedQuantity: 0 });
    expect(doc.items[0].unitCost).toBe(100);
    await acceptTransfer(targetScope, String(doc._id), actor);
    await acceptTransfer(targetScope, String(doc._id), actor);
    expect(await InventoryBalanceModel.findOne({ warehouseId: targetWarehouseId }).lean()).toMatchObject({ quantity: 1, averageCost: 100 });
    expect(await InventoryBalanceModel.findOne({ warehouseId: doc.transitWarehouseId }).lean()).toMatchObject({ quantity: 0 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(4);
    await expect(cancelTransfer(scope, String(doc._id), "Too late", actor)).rejects.toMatchObject({ statusCode: 409 });
    const balances = await InventoryBalanceModel.find().lean();
    expect(balances.reduce((sum, b) => sum + b.quantity * b.averageCost, 0)).toBe(200);
  });

  it("replays concurrent identical dispatches and rejects payload changes", async () => {
    const request = input();
    const [first, second] = await Promise.all([createTransfer(scope, request, actor), createTransfer(scope, request, actor)]);
    expect(String(first._id)).toBe(String(second._id));
    expect(await quantity()).toBe(1);
    expect(await InventoryTransferModel.countDocuments()).toBe(1);
    await expect(createTransfer(scope, { ...request, reason: "Changed" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await cancelTransfer(scope, String(first._id), "Cancel", actor);
    expect(String((await createTransfer(scope, request, actor))._id)).toBe(String(first._id));
    expect(await quantity()).toBe(2);
  });

  it("isolates costs of different shipments and returns the frozen cost on cancellation", async () => {
    const first = await createTransfer(scope, input(), actor);
    await writeStockMovement({ ...scope, warehouseId, direction: "in", purpose: "purchase", sourceType: "test", sourceId: id(), idempotencyKey: id(), operatorName: actor.name, items: [line({ unitCost: 300 })], writeLegacyStockLog: false });
    const second = await createTransfer(scope, input(), actor);
    expect(first.items[0].unitCost).toBe(100);
    expect(second.items[0].unitCost).toBe(200);
    expect(first.transitWarehouseId).not.toBe(second.transitWarehouseId);
    await cancelTransfer(scope, String(first._id), "Cancel", actor);
    await cancelTransfer(scope, String(first._id), "Retry", actor);
    expect(await InventoryBalanceModel.findOne({ warehouseId }).lean()).toMatchObject({ quantity: 2, averageCost: 150 });
    await acceptTransfer(targetScope, String(second._id), actor);
    expect(await InventoryBalanceModel.findOne({ warehouseId: targetWarehouseId }).lean()).toMatchObject({ quantity: 1, averageCost: 200 });
  });

  it("serializes competing receipt and cancellation without duplicating stock", async () => {
    const doc = await createTransfer(scope, input(), actor);
    const results = await Promise.allSettled([acceptTransfer(targetScope, String(doc._id), actor), cancelTransfer(scope, String(doc._id), "Cancel", actor)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await InventoryBalanceModel.find().lean()).reduce((sum, b) => sum + b.quantity, 0)).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(4);
  });

  it("moves tracked units, preserves a shared document history and scoped transit visibility", async () => {
    const unit = await machine();
    const doc = await createTransfer(scope, input({ items: [line({ unitIdentifiers: [unit.serialNumber] })] }), actor);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_transit", warehouseId: doc.transitWarehouseId });
    expect((await listSerialUnits({ ...scope, warehouseId }, { status: "in_transit" })).total).toBe(1);
    expect((await listSerialUnits({ ...targetScope, warehouseId: targetWarehouseId }, { status: "in_transit" })).total).toBe(1);
    await expect(transitionSerialUnit(scope, String(unit._id), { toStatus: "in_stock", eventType: "manual" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await acceptTransfer(targetScope, String(doc._id), actor);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_stock", branchId: targetBranchId, warehouseId: targetWarehouseId });
    const history = await getSerialHistory(scope, String(unit._id));
    expect(history).toHaveLength(2);
    expect(history.every((event) => event.documentId === String(doc._id))).toBe(true);
    expect(await getSerialHistory(targetScope, String(unit._id))).toHaveLength(2);
    await expect(getSerialHistory({ companyCode, branchId: id() }, String(unit._id))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("supports unit barcodes and rejects duplicate aliases or unavailable units", async () => {
    const unit = await machine();
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "unit_barcode" });
    await expect(createTransfer(scope, input({ items: [line({ quantity: 2, unitIdentifiers: [unit.serialNumber, unit.internalBarcode] })] }), actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(createTransfer(scope, input({ items: [line({ quantity: 2, unitIdentifiers: [unit.serialNumber] })] }), actor)).rejects.toMatchObject({ statusCode: 400 });
    const doc = await createTransfer(scope, input({ items: [line({ unitIdentifiers: [unit.internalBarcode] })] }), actor);
    await expect(createTransfer(scope, input({ items: [line({ unitIdentifiers: [unit.internalBarcode] })] }), actor)).rejects.toMatchObject({ statusCode: 409 });
    await cancelTransfer(scope, String(doc._id), "Wrong destination", actor);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_stock", warehouseId });
    expect(await quantity()).toBe(2);
  });

  it("rolls back every write when a later SKU has insufficient stock", async () => {
    await expect(createTransfer(scope, input({ items: [line(), line({ variantId: secondVariantId, sku: "SKU-B" })] }), actor)).rejects.toThrow();
    expect(await quantity()).toBe(2);
    expect(await InventoryTransferModel.countDocuments()).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await WarehouseModel.countDocuments({ kind: "transit" })).toBe(0);
  });

  it("rolls back dispatch and receipt when writing the serial event fails", async () => {
    const unit = await machine();
    const request = input({ items: [line({ unitIdentifiers: [unit.internalBarcode] })] });
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("Event unavailable"));
    await expect(createTransfer(scope, request, actor)).rejects.toThrow("Event unavailable");
    expect(await quantity()).toBe(2);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_stock", warehouseId });
    vi.restoreAllMocks();
    const doc = await createTransfer(scope, request, actor);
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("Event unavailable"));
    await expect(acceptTransfer(targetScope, String(doc._id), actor)).rejects.toThrow("Event unavailable");
    expect(await InventoryTransferModel.findById(doc._id).lean()).toMatchObject({ status: "in_transit" });
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_transit", warehouseId: doc.transitWarehouseId });
    expect(await InventoryBalanceModel.countDocuments({ warehouseId: targetWarehouseId })).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(2);
  });

  it("enforces tenant, branch, warehouse and canonical SKU boundaries", async () => {
    await expect(createTransfer({ companyCode: "OTHER", branchId }, input(), actor)).rejects.toThrow();
    await expect(createTransfer(targetScope, input(), actor)).rejects.toThrow();
    await expect(createTransfer(scope, input({ toWarehouseId: warehouseId }), actor)).rejects.toThrow();
    await expect(createTransfer(scope, input({ items: [line({ sku: "WRONG" })] }), actor)).rejects.toThrow();
    await expect(createTransfer(scope, input({ companyCode: "OTHER" }), actor)).rejects.toThrow();
    const doc = await createTransfer(scope, input(), actor);
    await expect(acceptTransfer(scope, String(doc._id), actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(cancelTransfer(targetScope, String(doc._id), "Cancel", actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(acceptTransfer({ ...targetScope, warehouseId }, String(doc._id), actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(getTransfer({ companyCode: "OTHER", branchId }, String(doc._id))).rejects.toMatchObject({ statusCode: 404 });
    expect((await listTransfers(scope)).total).toBe(1);
    expect((await listTransfers(targetScope)).total).toBe(1);
    expect((await listTransfers({ companyCode, branchId: id() })).total).toBe(0);
    expect(await transferDestinations("OTHER")).toHaveLength(0);
  });

  it("keeps transit out of physical warehouse selection and rejects manual/count writes", async () => {
    const doc = await createTransfer(scope, input(), actor);
    expect((await listWarehouses(companyCode, branchId)).some((w) => w.kind === "transit")).toBe(false);
    expect((await transferDestinations(companyCode)).some((w) => String(w._id) === doc.transitWarehouseId)).toBe(false);
    expect(await getWarehouse(companyCode, branchId, doc.transitWarehouseId)).toBeNull();
    await expect(createCount(scope, doc.transitWarehouseId, actor)).rejects.toThrow();
    await expect(writeStockMovement({ ...scope, warehouseId: doc.transitWarehouseId, direction: "out", purpose: "sale", sourceType: "manual", sourceId: id(), idempotencyKey: id(), operatorName: actor.name, items: [line()] })).rejects.toThrow();
  });

  it("supports same-branch moves and rejects inactive destinations", async () => {
    const doc = await createTransfer(scope, input({ toBranchId: branchId, toWarehouseId: otherWarehouseId }), actor);
    await acceptTransfer(scope, String(doc._id), actor);
    expect(await InventoryBalanceModel.findOne({ warehouseId: otherWarehouseId }).lean()).toMatchObject({ quantity: 1 });
    await WarehouseModel.updateOne({ _id: targetWarehouseId }, { isActive: false });
    await expect(createTransfer(scope, input(), actor)).rejects.toThrow();
  });

  it("requires reconciliation if the transit balance no longer matches its document", async () => {
    const doc = await createTransfer(scope, input(), actor);
    await InventoryBalanceModel.updateOne({ warehouseId: doc.transitWarehouseId }, { quantity: 0 });
    await expect(acceptTransfer(targetScope, String(doc._id), actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryTransferModel.findById(doc._id).lean()).toMatchObject({ status: "in_transit" });
  });

  it("routes legacy per-unit endpoints through the document and makes stale retries harmless", async () => {
    const unit = await machine();
    const args = { toBranchId: targetBranchId, toWarehouseId: targetWarehouseId, reason: "Replenish", idempotencyKey: "old-ui" };
    const first = await requestSerialTransfer(scope, String(unit._id), args, actor);
    expect((await requestSerialTransfer(scope, String(unit._id), args, actor)).transferId).toBe(first.transferId);
    await cancelSerialTransfer(scope, String(unit._id), "Cancel", actor, first.transferId);
    const second = await requestSerialTransfer(scope, String(unit._id), { ...args, idempotencyKey: "next-trip" }, actor);
    await cancelSerialTransfer(scope, String(unit._id), "Retry old cancel", actor, first.transferId);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "in_transit", currentDocumentId: second.transferId });
    await expect(acceptSerialTransfer(targetScope, String(unit._id), { transferId: first.transferId }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(acceptSerialTransfer(targetScope, String(unit._id), { transferId: second.transferId, warehouseId }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await acceptSerialTransfer(targetScope, String(unit._id), { transferId: second.transferId }, actor);
    expect(await InventoryBalanceModel.findOne({ warehouseId: targetWarehouseId }).lean()).toMatchObject({ quantity: 1 });
  });

  it("blocks legacy direct transfers, undocumented transit and partial receipt of a bulk document", async () => {
    const first = await machine("IMEI-1"), second = await machine("IMEI-2");
    await expect(transferSerialUnit(scope, String(first._id), { toBranchId: targetBranchId, reason: "Direct" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(acceptSerialTransfer(targetScope, String(first._id), {}, actor)).rejects.toThrow();
    const doc = await createTransfer(scope, input({ items: [line({ quantity: 2, unitIdentifiers: [first.internalBarcode, second.internalBarcode] })] }), actor);
    await expect(acceptSerialTransfer(targetScope, String(first._id), { transferId: String(doc._id) }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryTransferModel.findById(doc._id).lean()).toMatchObject({ status: "in_transit" });
  });
});
