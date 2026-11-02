import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryCountModel } from "../../../model/inventory-count.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { approveCount as approveReviewedCount, createCount, recreateCount, scanCountUnit, submitCount, updateCountItem } from "./inventory-count.service";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { SerialEventModel } from "../serials/serial-event.model";

const companyCode = "TEST";
const branchId = "branch-1";
const warehouseId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const variantId = new mongoose.Types.ObjectId().toString();
const scope = { companyCode, branchId };
let replSet: MongoMemoryReplSet;

// Existing invariant cases use a review of the current version. Validation
// cases below call approveReviewedCount directly with missing/stale evidence.
async function approveCount(scope: { companyCode: string; branchId: string }, id: string, actor: { id?: string; email?: string }) {
  const count = await InventoryCountModel.findById(id).lean();
  return approveReviewedCount(scope, id, actor, { expectedVersion: count?.version, discrepancyConfirmed: true, reason: "Reviewed physical count", unexpectedScanResolutions: [] });
}

async function seedCount(quantityDelta = 2, sourceBalanceVersion = 0) {
  await WarehouseModel.create({ _id: warehouseId, companyCode, branchId, code: "TEST", name: "Test warehouse", kind: "selling", isDefault: true, isActive: true });
  await ProductCatalogModel.create({ _id: productId, companyCode, productCode: "P-1", name: "Test product", normalizedName: "test product", productType: "physical", categoryCode: "GENERAL", baseUnitCode: "PCS", status: "active", createdBy: "test", updatedBy: "test" });
  await ProductVariantModel.create({ _id: variantId, companyCode, productId, sku: "SKU-1", barcode: "8930000000001", unitCode: "PCS", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test" });
  const balance = await InventoryBalanceModel.create({ companyCode, branchId, warehouseId, productId, variantId, sku: "SKU-1", quantity: 10, reservedQuantity: 0, averageCost: 5, version: 0 });
  return InventoryCountModel.create({ companyCode, branchId, warehouseId, countCode: "KK-1", status: "pending_approval", createdBy: "test", createdById: "creator", items: [{ productId, variantId, sku: "SKU-1", barcode: "8930000000001", productName: "Test product", systemQuantity: 10, countedQuantity: 10 + quantityDelta, quantityDelta, sourceBalanceVersion, note: "" }] });
}

describe("inventory count approval integration", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => { vi.restoreAllMocks(); await Promise.all([InventoryLedgerEntryModel.deleteMany({}), InventoryCountModel.deleteMany({}), InventoryBalanceModel.deleteMany({}), ProductVariantModel.deleteMany({}), ProductCatalogModel.deleteMany({}), WarehouseModel.deleteMany({}), SerialUnitModel.deleteMany({}), SerialEventModel.deleteMany({})]); });
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

  async function scanningCount() {
    const count: any = await seedCount(0);
    const units = await SerialUnitModel.create(["A", "B"].map((serial) => ({ ...scope, warehouseId, productId, variantId, sku: "SKU-1", productName: "Test", serialNumber: serial, normalizedSerialNumber: serial, internalBarcode: `BAR-${serial}`, normalizedInternalBarcode: `BAR-${serial}`, status: "in_stock" as const, createdBy: "test", updatedBy: "test" })));
    count.status = "counting";
    count.items[0].trackingMode = "serial";
    count.items[0].expectedUnits = units.map((unit) => ({ serialUnitId: String(unit._id), serialNumber: unit.serialNumber, internalBarcode: unit.internalBarcode }));
    count.items[0].scannedUnitIds = [];
    count.items[0].countedQuantity = 0;
    count.items[0].quantityDelta = -10;
    await count.save();
    return count;
  }

  it("preserves concurrent scans of different machines on the same line", async () => {
    const count = await scanningCount();
    const results = await Promise.all([scanCountUnit(scope, String(count._id), "A"), scanCountUnit(scope, String(count._id), "B")]);
    expect(results.map((result) => result.outcome)).toEqual(["counted", "counted"]);
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.items[0].scannedUnitIds).toHaveLength(2);
    expect(saved.items[0].countedQuantity).toBe(2);
    expect(saved.items[0].quantityDelta).toBe(-8);
    expect(saved.version).toBe(count.version + 2);
  });
  it("deduplicates concurrent serial and barcode scans for the same machine", async () => {
    const count = await scanningCount();
    const results = await Promise.all([scanCountUnit(scope, String(count._id), "A"), scanCountUnit(scope, String(count._id), "BAR-A")]);
    expect(results.map((result) => result.outcome).sort()).toEqual(["counted", "duplicate"]);
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.items[0].scannedUnitIds).toHaveLength(1);
    expect(saved.version).toBe(count.version + 1);
  });
  it("preserves unexpected scans concurrently without repeating the same code", async () => {
    const count = await scanningCount();
    await Promise.all(["UNKNOWN-A", "UNKNOWN-B", "UNKNOWN-A"].map((value) => scanCountUnit(scope, String(count._id), value)));
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.unexpectedScans.map((scan: any) => scan.code).sort()).toEqual(["UNKNOWN-A", "UNKNOWN-B"]);
    expect(saved.items[0].scannedUnitIds).toHaveLength(0);
  });
  it("rejects an item edit that was read before the count was submitted", async () => {
    const count: any = await seedCount();
    count.status = "counting"; await count.save();
    const original = InventoryCountModel.prototype.save;
    let submitted = false;
    vi.spyOn(InventoryCountModel.prototype, "save").mockImplementation(async function(this: any, options: any) {
      if (!submitted && this.isModified("items")) {
        submitted = true;
        await submitCount(scope, String(count._id), { id: "submitter" });
      }
      return original.call(this, options);
    });
    await expect(updateCountItem(scope, String(count._id), String(count.items[0]._id), { countedQuantity: 77, expectedVersion: count.version })).rejects.toMatchObject({ statusCode: 409, code: "COUNT_VERSION_CONFLICT" });
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.status).toBe("pending_approval");
    expect(saved.items[0].countedQuantity).toBe(12);
  });
  it("does not retry a scan into a count that has just been submitted", async () => {
    const count = await scanningCount();
    const original = InventoryCountModel.prototype.save;
    let submitted = false;
    vi.spyOn(InventoryCountModel.prototype, "save").mockImplementation(async function(this: any, options: any) {
      if (!submitted && this.isModified("items")) {
        submitted = true;
        await submitCount(scope, String(count._id), { id: "submitter" });
      }
      return original.call(this, options);
    });
    await expect(scanCountUnit(scope, String(count._id), "A")).rejects.toThrow(/chỉnh sửa/);
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.status).toBe("pending_approval");
    expect(saved.items[0].scannedUnitIds).toHaveLength(0);
  });
  it("bounds scan retries and never retries unrelated persistence failures", async () => {
    const count = await scanningCount();
    const save = vi.spyOn(InventoryCountModel.prototype, "save").mockRejectedValue({ name: "VersionError" });
    await expect(scanCountUnit(scope, String(count._id), "A")).rejects.toMatchObject({ statusCode: 409 });
    expect(save).toHaveBeenCalledTimes(5);
    save.mockClear().mockRejectedValue(new Error("connection failed"));
    await expect(scanCountUnit(scope, String(count._id), "A")).rejects.toThrow("connection failed");
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("does not turn a completed count into conflict after competing approvals", async () => {
    const count = await seedCount();
    const results = await Promise.allSettled([approveCount(scope, String(count._id), { id: "one" }), approveCount(scope, String(count._id), { id: "two" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("completed");
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(12);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(1);
  });
  it("rolls back an unrelated approval conflict without changing the count to stock conflict", async () => {
    const count = await seedCount();
    vi.spyOn(InventoryCountModel.prototype, "save").mockRejectedValueOnce(Object.assign(new Error("unrelated conflict"), { statusCode: 409 }));
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toThrow("unrelated conflict");
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("pending_approval");
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("rejects a stale-screen quantity or note edit even when requests are sequential", async () => {
    const count: any = await seedCount();
    count.status = "counting"; await count.save();
    const input = { countedQuantity: 11, expectedVersion: count.version };
    const next = await updateCountItem(scope, String(count._id), String(count.items[0]._id), input);
    expect(next.version).toBe(count.version + 1);
    for (const change of [{ countedQuantity: 99 }, { note: "stale" }]) {
      await expect(updateCountItem(scope, String(count._id), String(count.items[0]._id), { ...change, expectedVersion: count.version })).rejects.toMatchObject({ statusCode: 409 });
    }
    const saved: any = await InventoryCountModel.findById(count._id).lean();
    expect(saved.items[0].countedQuantity).toBe(11);
    expect(saved.items[0].note).toBe("");
    expect(saved.version).toBe(next.version);
  });
  it("requires a numeric nonnegative safe version for item edits", async () => {
    const count: any = await seedCount();
    count.status = "counting"; await count.save();
    for (const expectedVersion of [undefined, null, "1", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(updateCountItem(scope, String(count._id), String(count.items[0]._id), { countedQuantity: 99, expectedVersion })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect((await InventoryCountModel.findById(count._id).lean())?.version).toBe(count.version);
  });
  it("captures balances and expected machines from one snapshot despite an intervening stock change", async () => {
    await scanningCount();
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 2 });
    const original = mongoose.Query.prototype.exec;
    let changed = false;
    vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(async function(this: any, ...args: any[]) {
      const result = await original.apply(this, args as any);
      if (!changed && this.model === InventoryBalanceModel && this.op === "find" && this.getOptions().session) {
        changed = true;
        await mongoose.connection.transaction(async (session) => {
          await InventoryBalanceModel.updateOne({ variantId }, { $set: { quantity: 1 }, $inc: { version: 1 } }, { session });
          await SerialUnitModel.updateOne({ serialNumber: "A" }, { status: "sold" }, { session });
        });
      }
      return result;
    });
    const started = new Date();
    const count: any = await createCount(scope, warehouseId, { id: "counter" });
    expect(changed).toBe(true);
    expect(count.snapshotStartedAt.getTime()).toBeGreaterThanOrEqual(started.getTime());
    expect(count.items[0].systemQuantity).toBe(2);
    expect(count.items[0].sourceBalanceVersion).toBe(0);
    expect(count.items[0].expectedUnits).toHaveLength(2);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
    count.status = "pending_approval"; await count.save();
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toMatchObject({ code: "COUNT_STOCK_CONFLICT" });
  });
  it("rejects approval when a new SKU balance appears after count creation", async () => {
    const count = await seedCount();
    await InventoryBalanceModel.create({ ...scope, warehouseId, productId, variantId: new mongoose.Types.ObjectId().toString(), sku: "NEW", quantity: 1, averageCost: 5, version: 0 });
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toMatchObject({ code: "COUNT_STOCK_CONFLICT" });
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("conflict");
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("allows an empty warehouse snapshot but rejects it after stock is introduced", async () => {
    await seedCount();
    await InventoryBalanceModel.deleteMany({});
    const count: any = await createCount(scope, warehouseId, { id: "counter" });
    expect(count.items).toHaveLength(0);
    count.status = "pending_approval"; await count.save();
    expect((await approveCount(scope, String(count._id), { id: "approver" })).status).toBe("completed");
    const second: any = await createCount(scope, warehouseId, { id: "counter" });
    second.status = "pending_approval"; await second.save();
    await InventoryBalanceModel.create({ ...scope, warehouseId, productId, variantId, sku: "SKU-1", quantity: 1, averageCost: 5 });
    await expect(approveCount(scope, String(second._id), { id: "approver" })).rejects.toMatchObject({ code: "COUNT_STOCK_CONFLICT" });
  });
  it("does not create a snapshot for a warehouse outside scope or transit", async () => {
    await seedCount();
    await expect(createCount({ ...scope, companyCode: "OTHER" }, warehouseId, { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(createCount({ ...scope, branchId: "OTHER" }, warehouseId, { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    await WarehouseModel.updateOne({ _id: warehouseId }, { kind: "transit" });
    await expect(createCount(scope, warehouseId, { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryCountModel.countDocuments()).toBe(1);
  });
  it("fails before creating a count when transactions are disabled", async () => {
    await seedCount();
    vi.stubEnv("DISABLE_TRANSACTIONS", "true");
    try { await expect(createCount(scope, warehouseId, { id: "counter" })).rejects.toMatchObject({ statusCode: 503 }); }
    finally { vi.unstubAllEnvs(); }
    expect(await InventoryCountModel.countDocuments()).toBe(1);
  });
  it("leaves no partial count when snapshot document persistence fails", async () => {
    await seedCount();
    vi.spyOn(InventoryCountModel, "create").mockRejectedValueOnce(new Error("snapshot save failed"));
    await expect(createCount(scope, warehouseId, { id: "counter" })).rejects.toThrow("snapshot save failed");
    expect(await InventoryCountModel.countDocuments()).toBe(1);
    expect((await InventoryBalanceModel.findOne().lean())?.version).toBe(0);
  });
  it("rejects both the creator and submitter as approvers before stock changes", async () => {
    const count = await seedCount();
    await InventoryCountModel.updateOne({ _id: count._id }, { submittedBy: "changed-email", submittedById: "submitter" });
    for (const id of ["creator", "submitter"]) {
      await expect(approveCount(scope, String(count._id), { id, email: "new-name" })).rejects.toMatchObject({ statusCode: 403 });
    }
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("pending_approval");
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    const approved = await approveCount(scope, String(count._id), { id: "independent", email: "test" });
    expect(approved.approvedById).toBe("independent");
  });
  it("requires authenticated actor IDs and blocks legacy counts without verifiable authors", async () => {
    const count = await seedCount();
    await expect(approveCount(scope, String(count._id), {})).rejects.toMatchObject({ statusCode: 401 });
    await expect(createCount(scope, warehouseId, {})).rejects.toMatchObject({ statusCode: 401 });
    await InventoryCountModel.updateOne({ _id: count._id }, { $unset: { createdById: 1 } });
    await expect(approveCount(scope, String(count._id), { id: "independent" })).rejects.toMatchObject({ statusCode: 409 });
    await InventoryCountModel.updateOne({ _id: count._id }, { createdById: "creator", submittedBy: "legacy-email" });
    await expect(approveCount(scope, String(count._id), { id: "independent" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("pending_approval");
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("records stable creator and submitter IDs independently of display names", async () => {
    await seedCount();
    const count: any = await createCount(scope, warehouseId, { id: "author-id", email: "same@example.test" });
    expect(count.createdById).toBe("author-id");
    count.status = "counting"; await count.save();
    const submitted = await submitCount(scope, String(count._id), { id: "submit-id", email: "same@example.test" });
    expect(submitted.submittedById).toBe("submit-id");
    const approved = await approveCount(scope, String(count._id), { id: "approve-id", email: "same@example.test" });
    expect(approved.approvedById).toBe("approve-id");
  });
  it("recreates a conflicted count from current stock with empty counts and reciprocal links", async () => {
    const source: any = await scanningCount();
    source.status = "conflict"; source.items[0].scannedUnitIds = [source.items[0].expectedUnits[0].serialUnitId]; await source.save();
    await ProductVariantModel.updateOne({ _id: variantId }, { trackingMode: "serial" });
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 1, version: 5 });
    await SerialUnitModel.updateOne({ serialNumber: "A" }, { status: "sold" });
    const next: any = await recreateCount(scope, String(source._id), { id: "new-counter" });
    expect(next).toMatchObject({ status: "draft", recreatedFromId: String(source._id), createdById: "new-counter" });
    expect(next.items[0]).toMatchObject({ systemQuantity: 1, sourceBalanceVersion: 5, countedQuantity: 0, quantityDelta: -1 });
    expect(next.items[0].expectedUnits).toHaveLength(1);
    expect(next.items[0].scannedUnitIds).toHaveLength(0);
    const old: any = await InventoryCountModel.findById(source._id).lean();
    expect(old.replacementCountId).toBe(String(next._id));
    expect(old.status).toBe("conflict");
    expect(old.items[0].scannedUnitIds).toHaveLength(1);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("returns the same replacement for concurrent and later retries", async () => {
    const source = await seedCount(); source.status = "conflict"; await source.save();
    const [one, two] = await Promise.all([recreateCount(scope, String(source._id), { id: "one" }), recreateCount(scope, String(source._id), { id: "two" })]);
    expect(String(one._id)).toBe(String(two._id));
    const retry = await recreateCount(scope, String(source._id), { id: "three" });
    expect(String(retry._id)).toBe(String(one._id));
    expect(await InventoryCountModel.countDocuments()).toBe(2);
    expect(one.items[0].countedQuantity).toBe(0);
  });
  it("rolls back the replacement if linking the source fails", async () => {
    const source = await seedCount(); source.status = "conflict"; await source.save();
    const original = InventoryCountModel.prototype.save;
    vi.spyOn(InventoryCountModel.prototype, "save").mockImplementation(async function(this: any, options: any) {
      if (String(this._id) === String(source._id)) throw new Error("link failed");
      return original.call(this, options);
    });
    await expect(recreateCount(scope, String(source._id), { id: "counter" })).rejects.toThrow("link failed");
    expect(await InventoryCountModel.countDocuments()).toBe(1);
    expect((await InventoryCountModel.findById(source._id).lean())?.replacementCountId).toBeUndefined();
  });
  it("rejects non-conflict sources, other scopes, inactive warehouses and broken links", async () => {
    const source = await seedCount();
    await expect(recreateCount(scope, String(source._id), { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    source.status = "conflict"; await source.save();
    await expect(recreateCount({ ...scope, companyCode: "OTHER" }, String(source._id), { id: "counter" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(recreateCount({ ...scope, branchId: "OTHER" }, String(source._id), { id: "counter" })).rejects.toMatchObject({ statusCode: 404 });
    await WarehouseModel.updateOne({ _id: warehouseId }, { isActive: false });
    await expect(recreateCount(scope, String(source._id), { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    await InventoryCountModel.updateOne({ _id: source._id }, { replacementCountId: new mongoose.Types.ObjectId().toString() });
    await expect(recreateCount(scope, String(source._id), { id: "counter" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryCountModel.countDocuments()).toBe(1);
  });
  it("requires explicit review and a reason before applying discrepancies", async () => {
    const count = await seedCount();
    for (const review of [{}, { expectedVersion: count.version }, { expectedVersion: count.version, discrepancyConfirmed: true }, { expectedVersion: count.version, reason: "reviewed", discrepancyConfirmed: "true" }]) {
      await expect(approveReviewedCount(scope, String(count._id), { id: "approver" }, review)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(10);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    const result = await approveReviewedCount(scope, String(count._id), { id: "approver" }, { expectedVersion: count.version, discrepancyConfirmed: true, reason: "Physical quantity verified" });
    expect(result.approvalReview).toMatchObject({ expectedVersion: count.version, confirmedById: "approver", reason: "Physical quantity verified" });
  });
  it("rejects a stale approval without marking the document as stock conflict", async () => {
    const count = await seedCount();
    await expect(approveReviewedCount(scope, String(count._id), { id: "approver" }, { expectedVersion: count.version + 1, discrepancyConfirmed: true, reason: "reviewed" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await InventoryCountModel.findById(count._id).lean())?.status).toBe("pending_approval");
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
  it("requires an exact reasoned disposition for every unexpected scan", async () => {
    const count: any = await seedCount(0);
    count.unexpectedScans = [{ code: "EXTRA", reason: "unknown", scannedAt: new Date() }]; await count.save();
    for (const unexpectedScanResolutions of [[], [{ code: "WRONG", reason: "checked" }], [{ code: "EXTRA", reason: "" }], [{ code: "EXTRA", reason: "checked" }, { code: "EXTRA", reason: "again" }]]) {
      await expect(approveReviewedCount(scope, String(count._id), { id: "approver" }, { expectedVersion: count.version, unexpectedScanResolutions })).rejects.toMatchObject({ statusCode: 400 });
    }
    const result = await approveReviewedCount(scope, String(count._id), { id: "approver" }, { expectedVersion: count.version, unexpectedScanResolutions: [{ code: "EXTRA", reason: "Customer-owned equipment, excluded from warehouse" }] });
    expect(result.approvalReview?.unexpectedScanResolutions).toEqual([{ code: "EXTRA", reason: "Customer-owned equipment, excluded from warehouse" }]);
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(10);
  });
  async function missingMachineCount() {
    const count: any = await scanningCount();
    await InventoryBalanceModel.updateOne({ variantId }, { quantity: 2 });
    count.status = "pending_approval"; count.items[0].systemQuantity = 2;
    count.items[0].countedQuantity = 1; count.items[0].quantityDelta = -1;
    count.items[0].scannedUnitIds = [count.items[0].expectedUnits[0].serialUnitId];
    await count.save(); return count;
  }
  it("records confirmed missing machines with their count reference atomically", async () => {
    const count = await missingMachineCount();
    await approveCount(scope, String(count._id), { id: "approver" });
    expect((await SerialUnitModel.findOne({ serialNumber: "B" }).lean())).toMatchObject({ status: "lost", currentDocumentType: "inventory-count", currentDocumentId: String(count._id), updatedBy: "approver" });
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(1);
    expect(await SerialEventModel.countDocuments({ eventType: "count_lost" })).toBe(1);
  });
  it("rolls back stock and approval when a missing machine moved outside the counted warehouse", async () => {
    const count = await missingMachineCount();
    await SerialUnitModel.updateOne({ serialNumber: "B" }, { warehouseId: new mongoose.Types.ObjectId().toString() });
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toMatchObject({ statusCode: 409 });
    expect((await InventoryBalanceModel.findOne().lean())?.quantity).toBe(2);
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
    const saved = await InventoryCountModel.findById(count._id).lean();
    expect(saved?.approvalReview).toBeUndefined();
    expect(saved?.status).toBe("pending_approval");
  });
  it("rejects inconsistent tracked counts even after a user confirms them", async () => {
    const count = await missingMachineCount();
    await InventoryCountModel.updateOne({ _id: count._id }, { "items.0.countedQuantity": 0, "items.0.quantityDelta": -2 });
    await expect(approveCount(scope, String(count._id), { id: "approver" })).rejects.toMatchObject({ statusCode: 409 });
    expect(await InventoryLedgerEntryModel.countDocuments()).toBe(0);
  });
});
