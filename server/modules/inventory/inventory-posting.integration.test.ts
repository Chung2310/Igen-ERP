import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchModel } from "../../model/branch.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { ProductModel } from "../../model/product.model";
import { GoodsReceiptModel } from "../../model/goods-receipt.model";
import { confirmReceipt, createReceipt } from "./receiving/receiving.service";
import { ReceiptCounterModel } from "./receiving/receipt-counter.model";
import { nextReceiptCode, receiptBusinessDay } from "./receiving/receipt-number.service";
import { SupplierModel } from "../../model/supplier.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { registerSerialUnit, registerSerialBatch, transitionSerialUnit, listSerialUnits } from "./serials/serial-unit.service";
import { createTransfer } from "./transfers/transfer.service";
import { createCount, scanCountUnit } from "./counting/inventory-count.service";
import { InventoryCountModel } from "../../model/inventory-count.model";
import { createManualStockLog, updateManualStockLog, deleteManualStockLog } from "./manual-stock-log.service";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";
import { inInventoryTransaction } from "./inventory-transaction";
import { reverseManualOutbound } from "./stock-log-reversal.service";
import { RetailProductService } from "../retail/services/retail-product.service";
import { applyOrderStockOut } from "../retail/services/retail-stock.service";

const id = () => new mongoose.Types.ObjectId().toString();
const companyCode = "AUDIT";
const branchId = id(), warehouseId = id(), otherWarehouseId = id(), productId = id(), variantId = id(), secondVariantId = id();
const scope = { companyCode, branchId };
const models = [BranchModel, WarehouseModel, ProductCatalogModel, ProductVariantModel, InventoryBalanceModel, InventoryLedgerEntryModel, StockLogModel, SerialUnitModel, SerialEventModel, GoodsReceiptModel, ProductModel, InventoryCountModel, ReceiptCounterModel, SupplierModel];
let replica: MongoMemoryReplSet;
const line = (more: any = {}) => ({ productId, variantId, sku: "SKU-A", productName: "Phone", quantity: 1, unitPrice: 200, unitCost: 0, ...more });
const ticket = (more: any = {}) => ({ type: "xuất", purpose: "bán", status: "Hoàn thành", operatorName: "Tester", title: "Outbound", warehouseId, items: [line()], ...more });
async function quantity() { return (await InventoryBalanceModel.findOne({ warehouseId, variantId }).lean())!.quantity; }
async function machine(serial = "IMEI-1", extra: any = {}) {
  await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
  return SerialUnitModel.create({ ...scope, warehouseId, productId, variantId, sku: "SKU-A", productName: "Phone", serialNumber: serial, normalizedSerialNumber: serial, internalBarcode: `BAR-${serial}`, normalizedInternalBarcode: `BAR-${serial}`, status: "in_stock", createdBy: "test", updatedBy: "test", ...extra });
}

describe("inventory posting invariants", () => {
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replica.getUri());
    await Promise.all(models.map((model: any) => model.init()));
  }, 60000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(models.map((model: any) => model.deleteMany({})));
    await BranchModel.create({ _id: branchId, companyCode, code: "MAIN", name: "Main", isActive: true });
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

  async function receiptInput() {
    const supplier = await SupplierModel.create({ companyCode, branchId, code: "NCC", name: "Supplier", status: "active", createdBy: "u", updatedBy: "u" });
    return { supplierId: String(supplier._id), warehouseId, items: [line({ unitCost: 100 })] };
  }
  it("shares catalog definitions but never uses another branch's stock for POS", async () => {
    const destinationBranch = id(), destinationWarehouse = id();
    const destinationScope = { companyCode, branchId: destinationBranch };
    await BranchModel.create({ _id: destinationBranch, companyCode, code: "CN2", name: "Branch 2", isActive: true });
    await WarehouseModel.create({ _id: destinationWarehouse, ...destinationScope, code: "DEFAULT", name: "Branch 2", isDefault: true, isActive: true });
    const catalog = await RetailProductService.search(destinationScope, {});
    expect(catalog.items.find((item) => item.sku === "SKU-A")).toMatchObject({ stock: 0 });
    await expect(inInventoryTransaction((session) => applyOrderStockOut(destinationScope, id(), "POS-CN2", [line({ productId: variantId })] as any, "Tester", false, session))).rejects.toThrow();
    expect(await quantity()).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await ProductCatalogModel.countDocuments({ companyCode })).toBe(1);
  });

  it("POS barcode lookup only matches serial units in its selling warehouse", async () => {
    await machine("SECONDARY-IMEI");
    await machine("SELLING-IMEI", { warehouseId: otherWarehouseId });
    await machine("FOREIGN-IMEI", { branchId: id(), warehouseId: id() });
    expect((await RetailProductService.search(scope, { barcode: "SECONDARY-IMEI" })).items).toHaveLength(0);
    expect((await RetailProductService.search(scope, { barcode: "FOREIGN-IMEI" })).items).toHaveLength(0);
    expect((await RetailProductService.search(scope, { barcode: "SELLING-IMEI" })).items).toHaveLength(1);
  });
  it("creates concurrent receipts with distinct atomic numbers on the first counter use", async () => {
    const input = await receiptInput();
    const receipts = await Promise.all(Array.from({ length: 12 }, () => createReceipt(scope, input, { id: "u" })));
    expect(new Set(receipts.map((receipt) => receipt.receiptCode)).size).toBe(12);
    expect(receipts.map((receipt) => Number(receipt.receiptCode.split("-").at(-1))).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(await ReceiptCounterModel.countDocuments()).toBe(1);
    expect(await GoodsReceiptModel.countDocuments()).toBe(12);
  });
  it("does not reuse receipt numbers after deletion or a branch-code rename", async () => {
    const input = await receiptInput();
    const first = await createReceipt(scope, input, { id: "u" });
    await GoodsReceiptModel.deleteOne({ _id: first._id });
    await BranchModel.updateOne({ _id: branchId }, { code: "RENAMED" });
    const second = await createReceipt(scope, input, { id: "u" });
    expect(first.receiptCode.endsWith("-000001")).toBe(true);
    expect(second.receiptCode).toBe(first.receiptCode.replace(/000001$/, "000002"));
  });
  it("leaves a numbering gap after document persistence fails", async () => {
    const input = await receiptInput();
    vi.spyOn(GoodsReceiptModel, "create").mockRejectedValueOnce(new Error("write unavailable"));
    await expect(createReceipt(scope, input, { id: "u" })).rejects.toThrow("write unavailable");
    const receipt = await createReceipt(scope, input, { id: "u" });
    expect(receipt.receiptCode.endsWith("-000002")).toBe(true);
    expect(await GoodsReceiptModel.countDocuments()).toBe(1);
  });
  it("skips an occupied receipt number without modifying the existing document", async () => {
    const input = await receiptInput();
    const first = await createReceipt(scope, input, { id: "u" });
    // Simulate an old/imported document occupying the next allocation.
    await ReceiptCounterModel.updateOne({}, { sequence: 0 });
    const second = await createReceipt(scope, input, { id: "u" });
    expect(second.receiptCode.endsWith("-000002")).toBe(true);
    expect((await GoodsReceiptModel.findById(first._id).lean())?.receiptCode).toBe(first.receiptCode);
  });
  it("bounds receipt-code retries and propagates unrelated unique errors", async () => {
    const input = await receiptInput();
    const create = vi.spyOn(GoodsReceiptModel, "create").mockRejectedValue({ code: 11000, keyPattern: { companyCode: 1, receiptCode: 1 } });
    await expect(createReceipt(scope, input, { id: "u" })).rejects.toMatchObject({ statusCode: 409 });
    expect(create).toHaveBeenCalledTimes(10);
    create.mockClear().mockRejectedValue({ code: 11000, keyPattern: { companyCode: 1, idempotencyKey: 1 } });
    await expect(createReceipt(scope, input, { id: "u" })).rejects.toMatchObject({ keyPattern: { idempotencyKey: 1 } });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("separates counters by company, branch and business day", async () => {
    const branch2 = id(), branch3 = id();
    await BranchModel.create([{ _id: branch2, companyCode, code: "TWO", name: "Two", isActive: true }, { _id: branch3, companyCode: "OTHER", code: "MAIN", name: "Other", isActive: true }]);
    const codes = await Promise.all([
      nextReceiptCode(scope, "20260929"), nextReceiptCode(scope, "20260930"),
      nextReceiptCode({ companyCode, branchId: branch2 }, "20260929"),
      nextReceiptCode({ companyCode: "OTHER", branchId: branch3 }, "20260929"),
    ]);
    expect(new Set(codes).size).toBe(4);
    expect(codes.every((code) => code.endsWith("-000001"))).toBe(true);
    expect(await ReceiptCounterModel.countDocuments()).toBe(4);
    await expect(nextReceiptCode({ companyCode: "OTHER", branchId }, "20260929")).rejects.toThrow();
    expect(await ReceiptCounterModel.countDocuments()).toBe(4);
  });
  it("uses configured local midnight for numbering and rejects an invalid timezone", () => {
    expect(receiptBusinessDay(new Date("2026-09-29T16:59:59Z"), "Asia/Ho_Chi_Minh")).toBe("20260929");
    expect(receiptBusinessDay(new Date("2026-09-29T17:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("20260930");
    expect(receiptBusinessDay(new Date("2026-09-29T17:00:00Z"), "UTC")).toBe("20260929");
    expect(() => receiptBusinessDay(new Date(), "invalid-zone")).toThrow();
    vi.stubEnv("INVENTORY_TIME_ZONE", "Pacific/Kiritimati");
    try { expect(receiptBusinessDay(new Date("2026-09-29T12:00:00Z"))).toBe("20260930"); }
    finally { vi.unstubAllEnvs(); }
  });
  it("fails safely when the receipt counter exhausts safe integer capacity", async () => {
    await nextReceiptCode(scope, "20260929");
    await ReceiptCounterModel.updateOne({}, { sequence: Number.MAX_SAFE_INTEGER });
    await expect(nextReceiptCode(scope, "20260929")).rejects.toMatchObject({ statusCode: 409 });
    expect((await ReceiptCounterModel.findOne().lean())?.sequence).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rolls back the first line when a later line has insufficient stock", async () => {
    await expect(createManualStockLog(scope, ticket({ items: [line(), line({ variantId: secondVariantId, sku: "SKU-B" })] }))).rejects.toThrow(/tồn/);
    expect(await quantity()).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await StockLogModel.countDocuments()).toBe(0);
  });
  it("uses the persisted secondary warehouse on a status-only update and snapshots actual cost", async () => {
    const draft = await createManualStockLog(scope, ticket({ status: "Đang chờ" }));
    const posted = await updateManualStockLog(scope, String(draft._id), { status: "Hoàn thành" });
    expect(posted.warehouseId).toBe(warehouseId);
    expect(posted.items[0].unitCost).toBe(100);
    expect(await quantity()).toBe(1);
    expect((await InventoryLedgerEntryModel.findOne().lean())?.warehouseId).toBe(warehouseId);
    await updateManualStockLog(scope, String(draft._id), { status: "Hoàn thành" });
    expect(await quantity()).toBe(1);
  });
  it("rejects modifications and deletion of a posted document", async () => {
    const posted = await createManualStockLog(scope, ticket());
    await expect(updateManualStockLog(scope, String(posted._id), { items: [line({ quantity: 2 })] })).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteManualStockLog(scope, String(posted._id))).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
    expect(await StockLogModel.countDocuments()).toBe(1);
  });
  it("replays the same create key without subtracting stock twice and rejects changed content", async () => {
    const input = ticket({ idempotencyKey: "request-1" });
    const first = await createManualStockLog(scope, input);
    const replay = await createManualStockLog(scope, input);
    expect(String(first._id)).toBe(String(replay._id));
    await expect(createManualStockLog(scope, { ...input, items: [line({ quantity: 2 })] })).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
  });
  it("prevents two concurrent documents from consuming the last unit", async () => {
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 1 });
    const results = await Promise.allSettled([createManualStockLog(scope, ticket()), createManualStockLog(scope, ticket())]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await quantity()).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });
  it("returns one document for concurrent retries with the same request key", async () => {
    const input = ticket({ idempotencyKey: "concurrent-retry" });
    const [first, second] = await Promise.all([createManualStockLog(scope, input), createManualStockLog(scope, input)]);
    expect(String(first._id)).toBe(String(second._id));
    expect(await quantity()).toBe(1);
    expect(await StockLogModel.countDocuments()).toBe(1);
  });
  it("deduplicates concurrent draft creation without a balance write to serialize requests", async () => {
    const input = ticket({ status: "Đang chờ", idempotencyKey: "draft-retry" });
    const [first, second] = await Promise.all([createManualStockLog(scope, input), createManualStockLog(scope, input)]);
    expect(String(first._id)).toBe(String(second._id));
    expect(await StockLogModel.countDocuments()).toBe(1);
    expect(await quantity()).toBe(2);
  });
  it("rolls back receipt confirmation and stock when an incoming serial already exists", async () => {
    await machine();
    const receipt = await GoodsReceiptModel.create({ ...scope, warehouseId, receiptCode: "PN-1", supplierId: "supplier", supplierName: "Supplier", status: "receiving", subtotal: 100, createdBy: "u", items: [{ ...line(), quantity: 1, unitCost: 100, lineTotal: 100, trackingMode: "serial", serialNumbers: ["IMEI-1"], unitDetails: [{ internalBarcode: "NEW-BAR" }] }] });
    await expect(confirmReceipt(scope, String(receipt._id), { id: "u", email: "tester" })).rejects.toMatchObject({ code: "UNIT_ID_DUPLICATE" });
    expect((await GoodsReceiptModel.findById(receipt._id).lean())?.status).toBe("receiving");
    expect(await quantity()).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("rejects reusing a movement key for different quantities", async () => {
    const input = { ...scope, warehouseId, direction: "out" as const, purpose: "sale" as const, sourceType: "test", sourceId: "key-test", idempotencyKey: "same-key", operatorName: "Tester", items: [line()] };
    await writeStockMovement(input);
    await expect(writeStockMovement({ ...input, items: [line({ quantity: 2 })] })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await quantity()).toBe(1);
  });
  it("confirms tracked receipts from zero stock and replays without registering twice", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await InventoryBalanceModel.deleteMany({});
    const receipt = await GoodsReceiptModel.create({ ...scope, warehouseId, receiptCode: "PN-NEW", supplierId: "supplier", supplierName: "Supplier", status: "receiving", subtotal: 100, createdBy: "u", items: [{ ...line(), unitCost: 100, lineTotal: 100, trackingMode: "serial", serialNumbers: ["RECEIVED"], unitDetails: [{ internalBarcode: "RECEIVED-BAR" }] }] });
    await confirmReceipt(scope, String(receipt._id), { id: "u", email: "tester" });
    await confirmReceipt(scope, String(receipt._id), { id: "u", email: "tester" });
    expect(await quantity()).toBe(1);
    expect(await SerialUnitModel.countDocuments({ status: "in_stock" })).toBe(1);
    expect(await SerialEventModel.countDocuments()).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect((await GoodsReceiptModel.findById(receipt._id).lean())?.status).toBe("confirmed");
  });
  it("keeps registration and a concurrent tracked outbound consistent", async () => {
    await machine();
    await Promise.all([
      registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "NEW", internalBarcode: "NEW" }, { id: "u", name: "User" }),
      createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: ["IMEI-1"] })] })),
    ]);
    expect(await quantity()).toBe(1);
    expect(await SerialUnitModel.countDocuments({ status: "in_stock" })).toBe(1);
    expect((await SerialUnitModel.findOne({ serialNumber: "NEW" }).lean())?.status).toBe("in_stock");
    expect((await SerialUnitModel.findOne({ serialNumber: "IMEI-1" }).lean())?.status).toBe("sold");
  });
  it.each(["wrong-warehouse", "wrong-variant", "sold", "missing-code"])("rejects a %s machine atomically", async (mode) => {
    await machine("IMEI-1", mode === "wrong-warehouse" ? { warehouseId: otherWarehouseId } : mode === "wrong-variant" ? { variantId: secondVariantId } : mode === "sold" ? { status: "sold" } : {});
    await expect(createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: mode === "missing-code" ? [] : ["IMEI-1"] })] }))).rejects.toThrow();
    expect(await quantity()).toBe(2);
    expect(await StockLogModel.countDocuments()).toBe(0);
  });
  it("does not accept the IMEI and barcode of one machine as two separate units", async () => {
    await machine();
    await expect(createManualStockLog(scope, ticket({ items: [line({ quantity: 2, unitIdentifiers: ["IMEI-1", "BAR-IMEI-1"] })] }))).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(2);
  });
  it("rolls back stock, ledger and machine status if the event write fails", async () => {
    await machine();
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("event write failed"));
    await expect(createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: ["IMEI-1"] })] }))).rejects.toThrow("event write failed");
    expect(await quantity()).toBe(2);
    expect((await SerialUnitModel.findOne().lean())?.status).toBe("in_stock");
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("scraps rather than sells machines on a disposal document", async () => {
    await machine();
    await createManualStockLog(scope, ticket({ purpose: "hủy", items: [line({ unitIdentifiers: ["IMEI-1"] })] }));
    expect((await SerialUnitModel.findOne().lean())?.status).toBe("scrapped");
    expect(await quantity()).toBe(1);
  });
  it("rejects scope overrides when registering a machine before writing anything", async () => {
    await expect(registerSerialUnit(scope, { ...line(), serialNumber: "IMEI", companyCode: "OTHER" } as any, { id: "u", name: "User" })).rejects.toThrow(/companyCode/);
    expect(await SerialUnitModel.countDocuments()).toBe(0);
  });
  it("validates SKU identity and scopes machine and event to the authenticated company", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    const unit = await registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "IMEI", internalBarcode: "BAR" }, { id: "u", name: "User" });
    expect(unit.companyCode).toBe(companyCode);
    expect(unit.warehouseId).toBe(warehouseId);
    await expect(registerSerialUnit({ ...scope, warehouseId }, { ...line({ sku: "SKU-B" }), serialNumber: "IMEI-2" }, { id: "u", name: "User" })).rejects.toThrow(/SKU/);
    expect(await SerialEventModel.countDocuments({ companyCode })).toBe(1);
  });
  it("rolls back a direct multi-line movement without a caller-supplied session", async () => {
    await expect(writeStockMovement({ ...scope, warehouseId, direction: "out", purpose: "sale", sourceType: "test", sourceId: "direct", idempotencyKey: "direct", operatorName: "Tester", items: [line(), line({ variantId: secondVariantId, sku: "SKU-B" })] })).rejects.toThrow();
    expect(await quantity()).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("registers identifiers against existing quantity without changing stock or value", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "unit_barcode" });
    await InventoryBalanceModel.updateOne({ variantId }, { reservedQuantity: 2 });
    await registerSerialBatch({ ...scope, warehouseId }, {
      ...line(),
      quantity: 2,
      unitDetails: [
        { serialNumber: "SERIAL-B1", internalBarcode: "BAR-B1" },
        { serialNumber: "SERIAL-B2", internalBarcode: "BAR-B2" },
      ],
    }, { id: "u", name: "User" });
    const balance = await InventoryBalanceModel.findOne({ variantId }).lean();
    expect(balance).toMatchObject({ quantity: 2, reservedQuantity: 2, averageCost: 100, version: 2 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    expect(await SerialEventModel.countDocuments()).toBe(2);
    expect(await SerialUnitModel.find({ variantId }).sort({ serialNumber: 1 }).lean()).toMatchObject([
      { serialNumber: "SERIAL-B1", internalBarcode: "BAR-B1" },
      { serialNumber: "SERIAL-B2", internalBarcode: "BAR-B2" },
    ]);
    await expect(registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "B3" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await InventoryBalanceModel.findOne({ variantId }).lean())?.version).toBe(2);
  });
  it("rejects registration without valid stock even with a claimed receipt source", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    const input = { ...line(), serialNumber: "NEW", documentType: "goods-receipt", documentId: id() };
    for (const quantity of [0, -1, 0.5]) {
      await InventoryBalanceModel.updateOne({ variantId }, { quantity });
      await expect(registerSerialUnit({ ...scope, warehouseId }, input, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    }
    await InventoryBalanceModel.deleteMany({});
    await expect(registerSerialUnit({ ...scope, warehouseId }, input, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await SerialUnitModel.countDocuments()).toBe(0);
    expect(await SerialEventModel.countDocuments()).toBe(0);
  });
  it("rolls back the entire identifier batch when it exceeds unassigned quantity", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await expect(registerSerialBatch({ ...scope, warehouseId }, { ...line(), serialNumbers: ["A", "B", "C"] }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await SerialUnitModel.countDocuments()).toBe(0);
    expect(await SerialEventModel.countDocuments()).toBe(0);
    expect((await InventoryBalanceModel.findOne({ variantId }).lean())?.version).toBe(0);
  });
  it("serializes two registrations competing for the final unassigned unit", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 1 });
    const results = await Promise.allSettled(["A", "B"].map((code) => registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: code, internalBarcode: code }, { id: "u", name: "User" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await SerialUnitModel.countDocuments()).toBe(1);
    expect(await SerialEventModel.countDocuments()).toBe(1);
    expect(await quantity()).toBe(1);
  });
  it("does not borrow unassigned stock from another warehouse", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await expect(registerSerialUnit({ ...scope, warehouseId: otherWarehouseId }, { ...line(), serialNumber: "NEW" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await SerialUnitModel.countDocuments()).toBe(0);
    expect(await quantity()).toBe(2);
  });
  it("counts legacy in-stock identifiers but excludes machines outside on-hand stock", async () => {
    await machine();
    await SerialUnitModel.updateOne({}, { $unset: { variantId: 1 } });
    await registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "NEW", internalBarcode: "NEW" }, { id: "u", name: "User" });
    await expect(registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "EXTRA" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    await SerialUnitModel.updateOne({ serialNumber: "NEW" }, { status: "sold" });
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 1 });
    await expect(registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "EXTRA" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    // A later receipt can supply a new unassigned unit; the sold machine is history.
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 2 });
    await registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "EXTRA", internalBarcode: "EXTRA" }, { id: "u", name: "User" });
    expect(await SerialUnitModel.countDocuments({ status: "in_stock" })).toBe(2);
  });
  it("rolls back the balance lock and machine when registration event persistence fails", async () => {
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    vi.spyOn(SerialEventModel.prototype, "save").mockRejectedValueOnce(new Error("event unavailable"));
    await expect(registerSerialUnit({ ...scope, warehouseId }, { ...line(), serialNumber: "NEW" }, { id: "u", name: "User" })).rejects.toThrow("event unavailable");
    expect(await SerialUnitModel.countDocuments()).toBe(0);
    expect((await InventoryBalanceModel.findOne({ variantId }).lean())?.version).toBe(0);
  });
  it("does not run the callback when transaction support is explicitly disabled", async () => {
    vi.stubEnv("DISABLE_TRANSACTIONS", "true");
    const work = vi.fn();
    try { await expect(inInventoryTransaction(work)).rejects.toMatchObject({ statusCode: 503 }); expect(work).not.toHaveBeenCalled(); }
    finally { vi.unstubAllEnvs(); }
  });

  it("reverses outbound at original cost after later receipts, preserving the source", async () => {
    const original = await createManualStockLog(scope, ticket());
    await writeStockMovement({ ...scope, warehouseId, direction: "in", purpose: "other", sourceType: "test", sourceId: "later", idempotencyKey: "later", operatorName: "Tester", items: [line({ unitCost: 300 })], writeLegacyStockLog: false });
    const reversed = await reverseManualOutbound(scope, String(original._id), { reason: "Wrong issue" }, { id: "u", name: "Reviewer" });
    expect(reversed).toMatchObject({ type: "nhập", reversalOf: String(original._id), refType: "stock-log-reversal", operatorName: "Reviewer", createdById: "u", notes: "Wrong issue", warehouseId });
    expect(reversed.items[0].unitCost).toBe(100);
    const balance = await InventoryBalanceModel.findOne({ warehouseId, variantId }).lean();
    expect(balance!.quantity).toBe(3);
    expect(balance!.quantity * balance!.averageCost).toBeCloseTo(500);
    const saved = await StockLogModel.findById(original._id).lean();
    expect(saved).toMatchObject({ status: original.status, items: original.items, reversalId: String(reversed._id) });
    await expect(updateManualStockLog(scope, String(reversed._id), { notes: "Edit" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteManualStockLog(scope, String(original._id))).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deduplicates simultaneous reversal and rejects a changed reason", async () => {
    const original = await createManualStockLog(scope, ticket());
    const reverse = () => reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" });
    const [a, b] = await Promise.all([reverse(), reverse()]);
    expect(String(a._id)).toBe(String(b._id));
    expect(String((await reverse())._id)).toBe(String(a._id));
    expect(await quantity()).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(2);
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Changed" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each(["bán", "hủy"])("restores %s machines and records the authenticated actor", async (purpose) => {
    await machine();
    const original = await createManualStockLog(scope, ticket({ purpose, items: [line({ unitIdentifiers: ["BAR-IMEI-1"] })] }));
    const reversed = await reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" });
    expect(await quantity()).toBe(2);
    expect(await SerialUnitModel.findOne().lean()).toMatchObject({ status: "in_stock", warehouseId, currentDocumentType: "stock-log-reversal", currentDocumentId: String(reversed._id) });
    expect(await SerialEventModel.findOne({ documentId: String(reversed._id) }).lean()).toMatchObject({ actorId: "u", eventType: "stock_log_reversed", toStatus: "in_stock" });
  });

  it("rejects a machine that has a later business event, even if its current state appears unchanged", async () => {
    const unit = await machine();
    const original = await createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: ["IMEI-1"] })] }));
    await SerialEventModel.create({ ...scope, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "later", fromStatus: "sold", toStatus: "sold", actorId: "u", actorName: "User" });
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
    expect((await StockLogModel.findById(original._id).lean())!.reversalId).toBeUndefined();
  });

  it("rolls back the entire reversal when restoring a serial event fails", async () => {
    await machine();
    const original = await createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: ["IMEI-1"] })] }));
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("Event failure"));
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toThrow("Event failure");
    expect(await quantity()).toBe(1);
    expect((await SerialUnitModel.findOne().lean())!.status).toBe("sold");
    expect(await StockLogModel.countDocuments()).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
    expect((await StockLogModel.findById(original._id).lean())!.reversalId).toBeUndefined();
  });

  it("refuses missing or mismatched source ledger instead of guessing historical costs", async () => {
    const original = await createManualStockLog(scope, ticket());
    await InventoryLedgerEntryModel.updateOne({ sourceId: String(original._id) }, { unitCost: 99 });
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    await InventoryLedgerEntryModel.deleteMany({});
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
  });

  it("enforces reversal tenant, branch, warehouse, payload and source-document boundaries", async () => {
    const original = await createManualStockLog(scope, ticket());
    const actor = { id: "u", name: "User" }, input = { reason: "Correction" }, sourceId = String(original._id);
    await expect(reverseManualOutbound({ ...scope, companyCode: "OTHER" }, sourceId, input, actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(reverseManualOutbound({ ...scope, branchId: id() }, sourceId, input, actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(reverseManualOutbound({ ...scope, warehouseId: otherWarehouseId }, sourceId, input, actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(reverseManualOutbound(scope, sourceId, { ...input, items: [] } as any, actor)).rejects.toMatchObject({ statusCode: 400 });
    await expect(reverseManualOutbound(scope, sourceId, { reason: " " }, actor)).rejects.toMatchObject({ statusCode: 400 });
    await StockLogModel.updateOne({ _id: original._id }, { refType: "retail-order", refId: "order" });
    await expect(reverseManualOutbound(scope, sourceId, input, actor)).rejects.toMatchObject({ statusCode: 409 });
    const draft = await createManualStockLog(scope, ticket({ status: "Đang chờ" }));
    await expect(reverseManualOutbound(scope, String(draft._id), input, actor)).rejects.toMatchObject({ statusCode: 409 });
    const receipt = await createManualStockLog(scope, ticket({ type: "nhập" }));
    await expect(reverseManualOutbound(scope, String(receipt._id), input, actor)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("restores both legacy product stock and its inventory balance exactly once", async () => {
    // Legacy stock is a branch total and is first allocated to its default warehouse.
    await WarehouseModel.updateMany({ ...scope }, { isDefault: false });
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: true });
    const legacy = await ProductModel.create({ ...scope, sku: "LEGACY", name: "Legacy phone", category: "Phone", stock: 3, price: 200, costPrice: 100 });
    const original = await createManualStockLog(scope, ticket({ items: [line({ productId: String(legacy._id), variantId: undefined, sku: "LEGACY" })] }));
    expect((await ProductModel.findById(legacy._id).lean())!.stock).toBe(2);
    await reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" });
    expect((await ProductModel.findById(legacy._id).lean())!.stock).toBe(3);
    expect(await InventoryBalanceModel.findOne({ productId: String(legacy._id) }).lean()).toMatchObject({ quantity: 3, averageCost: 100 });
  });
  it("refuses to synthesize a missing balance or value a reversal over negative stock", async () => {
    const original = await createManualStockLog(scope, ticket());
    await InventoryBalanceModel.updateOne({ warehouseId, variantId }, { quantity: -1 });
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    await InventoryBalanceModel.deleteMany({});
    await expect(reverseManualOutbound(scope, String(original._id), { reason: "Correction" }, { id: "u", name: "User" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryBalanceModel.countDocuments()).toBe(0);
  });

  const actor = { id: "authenticated-user", name: "Authenticated User" };
  const internalTicket = (extra: any = {}) => ticket({ purpose: "nội bộ", customerName: "Phòng kỹ thuật", notes: "Máy kiểm thử", items: [line({ unitIdentifiers: ["BAR-IMEI-1"] })], ...extra });
  it.each(["serial", "unit_barcode"])("issues and recovers %s internal units with the original cost and authenticated audit", async (trackingMode) => {
    const unit = await machine();
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode });
    const source = await createManualStockLog(scope, internalTicket({ postedById: "forged", createdById: "forged" }), actor);
    expect(source).toMatchObject({ createdById: actor.id, postedById: actor.id, postedByName: actor.name });
    expect(await quantity()).toBe(1);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "internal_use", internalUse: { recipientName: "Phòng kỹ thuật", stockLogId: String(source._id), unitCost: 100 } });
    expect(await SerialEventModel.findOne({ documentId: String(source._id) }).lean()).toMatchObject({ eventType: "internal_use", actorId: actor.id });
    await writeStockMovement({ ...scope, warehouseId, direction: "in", purpose: "other", sourceType: "test", sourceId: "later", idempotencyKey: "later", operatorName: "Tester", items: [line({ unitCost: 300 })], writeLegacyStockLog: false });
    const recovered = await reverseManualOutbound(scope, String(source._id), { reason: "Đã nhận đủ máy" }, actor);
    expect(recovered.items[0].unitCost).toBe(100);
    const saved = await SerialUnitModel.findById(unit._id).lean();
    expect(saved!.status).toBe("in_stock");
    expect(saved!.internalUse).toBeUndefined();
    const balance = await InventoryBalanceModel.findOne({ warehouseId, variantId }).lean();
    expect(balance!.quantity * balance!.averageCost).toBeCloseTo(500);
  });
  it("requires recipient, reason and authenticated actor for an internal posting", async () => {
    await machine();
    for (const patch of [{ customerName: " " }, { notes: " " }]) {
      await expect(createManualStockLog(scope, internalTicket(patch), actor)).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(createManualStockLog(scope, internalTicket())).rejects.toMatchObject({ statusCode: 403 });
    expect(await quantity()).toBe(2);
    expect(await StockLogModel.countDocuments()).toBe(0);
  });
  it("records the authenticated poster on draft completion and replays status changes once", async () => {
    await machine();
    const draft = await createManualStockLog(scope, internalTicket({ status: "Đang chờ" }), { id: "creator", name: "Creator" });
    const posted = await updateManualStockLog(scope, String(draft._id), { status: "Hoàn thành" }, actor);
    await updateManualStockLog(scope, String(draft._id), { status: "Hoàn thành" }, actor);
    expect(posted).toMatchObject({ createdById: "creator", postedById: actor.id });
    expect(await quantity()).toBe(1);
    expect(await SerialEventModel.countDocuments()).toBe(1);
  });
  it.each([
    ["in_stock", "sold"], ["in_stock", "lost"], ["in_stock", "in_transit"], ["in_stock", "internal_use"],
    ["sold", "in_stock"], ["sold", "returned"], ["sold", "repairing"],
    ["returned", "in_stock"], ["returned", "defective"], ["defective", "repairing"], ["defective", "scrapped"],
    ["repairing", "in_stock"], ["repairing", "sold"], ["repairing", "defective"],
    ["lost", "in_stock"], ["in_transit", "in_stock"], ["internal_use", "in_stock"],
  ])("rejects direct %s -> %s even with a supplied document reference", async (fromStatus, toStatus) => {
    const unit = await machine("IMEI-1", { status: fromStatus, currentDocumentType: "original", currentDocumentId: "original-id" });
    const before = await SerialUnitModel.findById(unit._id).lean();
    await expect(transitionSerialUnit(scope, String(unit._id), { toStatus: toStatus as any, eventType: "sold", documentType: "retail-order", documentId: id() }, actor)).rejects.toMatchObject({ statusCode: 409, code: "SERIAL_WORKFLOW_REQUIRED" });
    expect(await SerialUnitModel.findById(unit._id).lean()).toEqual(before);
    expect(await quantity()).toBe(2);
    expect(await SerialEventModel.countDocuments()).toBe(0);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });

  it("hides machines outside the direct-transition scope", async () => {
    const unit = await machine();
    for (const requestScope of [{ ...scope, companyCode: "OTHER" }, { ...scope, branchId: id() }, { ...scope, warehouseId: otherWarehouseId }]) {
      await expect(transitionSerialUnit(requestScope, String(unit._id), { toStatus: "sold", eventType: "sold" }, actor)).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(await SerialEventModel.countDocuments()).toBe(0);
    expect((await SerialUnitModel.findById(unit._id).lean())?.status).toBe("in_stock");
  });

  it("prevents selling, transferring or bypassing lifecycle for an internally allocated machine", async () => {
    const unit = await machine();
    await expect(transitionSerialUnit(scope, String(unit._id), { toStatus: "internal_use", eventType: "manual" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await createManualStockLog(scope, internalTicket(), actor);
    await expect(createManualStockLog(scope, ticket({ items: [line({ unitIdentifiers: ["IMEI-1"] })] }), actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(createTransfer(scope, { fromWarehouseId: warehouseId, toBranchId: branchId, toWarehouseId: otherWarehouseId, reason: "Move", idempotencyKey: "internal-move", items: [line({ unitIdentifiers: ["IMEI-1"] })] }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(transitionSerialUnit(scope, String(unit._id), { toStatus: "in_stock", eventType: "manual" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
  });
  it("excludes internal units from sale selection and expected stock count", async () => {
    await machine();
    const available = await machine("IMEI-2");
    await WarehouseModel.updateOne({ _id: otherWarehouseId }, { isDefault: false });
    await WarehouseModel.updateOne({ _id: warehouseId }, { isDefault: true });
    await createManualStockLog(scope, internalTicket(), actor);
    const sale = await listSerialUnits(scope, { forSale: true, status: "in_stock", barcodes: ["BAR-IMEI-1"] });
    expect(sale.items.map((u) => String(u._id))).toEqual([String(available._id)]);
    const inUse = await listSerialUnits(scope, { status: "internal_use" });
    expect(inUse.total).toBe(1);
    const count = await createCount(scope, warehouseId, { id: actor.id });
    expect(count.items[0].expectedUnits).toHaveLength(1);
    expect(await scanCountUnit(scope, String(count._id), "IMEI-1")).toMatchObject({ outcome: "unexpected", reason: "wrong_status" });
  });
  it("rolls back allocation and recovery if serial event persistence fails", async () => {
    await machine();
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("Event failure"));
    await expect(createManualStockLog(scope, internalTicket(), actor)).rejects.toThrow("Event failure");
    expect(await quantity()).toBe(2);
    expect((await SerialUnitModel.findOne().lean())!.internalUse).toBeUndefined();
    vi.restoreAllMocks();
    const source = await createManualStockLog(scope, internalTicket(), actor);
    vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("Event failure"));
    await expect(reverseManualOutbound(scope, String(source._id), { reason: "Return" }, actor)).rejects.toThrow("Event failure");
    expect(await quantity()).toBe(1);
    expect(await SerialUnitModel.findOne().lean()).toMatchObject({ status: "internal_use", internalUse: { stockLogId: String(source._id) } });
  });
  it("deduplicates concurrent allocation and keeps a later allocation intact on old recovery retry", async () => {
    const unit = await machine();
    const input = internalTicket({ idempotencyKey: "allocation" });
    const [a, b] = await Promise.all([createManualStockLog(scope, input, actor), createManualStockLog(scope, input, actor)]);
    expect(String(a._id)).toBe(String(b._id));
    await reverseManualOutbound(scope, String(a._id), { reason: "Return" }, actor);
    const next = await createManualStockLog(scope, internalTicket({ idempotencyKey: "next" }), actor);
    await reverseManualOutbound(scope, String(a._id), { reason: "Return" }, actor);
    expect(await SerialUnitModel.findById(unit._id).lean()).toMatchObject({ status: "internal_use", internalUse: { stockLogId: String(next._id) } });
    expect(await quantity()).toBe(1);
  });
  it("refuses recovery when assignment identity no longer matches its source", async () => {
    await machine();
    const source = await createManualStockLog(scope, internalTicket(), actor);
    await SerialUnitModel.updateOne({}, { "internalUse.recipientName": "Someone else" });
    await expect(reverseManualOutbound(scope, String(source._id), { reason: "Return" }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await quantity()).toBe(1);
  });
});
