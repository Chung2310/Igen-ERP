import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { writeStockMovement } from "./stock-movement.service";
import type { WriteStockMovementInput } from "./stock-movement.service";

const companyCode = "TEST";
const branchId = "branch-1";
const warehouseId = new mongoose.Types.ObjectId().toString();
let replSet: MongoMemoryReplSet;

describe("stock movement integration", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      InventoryBalanceModel.deleteMany({}),
      InventoryLedgerEntryModel.deleteMany({}),
      StockLogModel.deleteMany({}),
      WarehouseModel.deleteMany({}),
    ]);
    await WarehouseModel.create({ _id: warehouseId, companyCode, branchId, code: "TEST", name: "Test warehouse", kind: "selling", isDefault: true, isActive: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  it("writes multiple ledger entries inside a transaction", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await writeStockMovement({
          companyCode,
          branchId,
          warehouseId,
          direction: "in",
          purpose: "purchase",
          sourceType: "goods-receipt",
          sourceId: "receipt-1",
          idempotencyKey: "receipt-1:confirm",
          operatorName: "tester",
          session,
          items: [
            { productId: "product-1", variantId: "variant-1", sku: "SKU-1", productName: "Product 1", quantity: 1, unitCost: 10 },
            { productId: "product-2", variantId: "variant-2", sku: "SKU-2", productName: "Product 2", quantity: 2, unitCost: 20 },
          ],
        });
      });
    } finally {
      await session.endSession();
    }

    expect(await InventoryLedgerEntryModel.countDocuments({ sourceId: "receipt-1" })).toBe(2);
  });

  const movement = (overrides: Partial<WriteStockMovementInput> = {}): WriteStockMovementInput => ({
    companyCode, branchId, warehouseId, direction: "out", purpose: "sale",
    sourceType: "test", sourceId: "sale-1", idempotencyKey: "sale-1", operatorName: "tester",
    items: [{ productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 1 }], ...overrides,
  });

  async function seedBalance(variantId = "variant-1", sku = "SKU-1", quantity = 5) {
    return InventoryBalanceModel.create({ companyCode, branchId, warehouseId, productId: "product-1", variantId, sku, quantity, averageCost: 20 });
  }

  it("rolls back earlier lines when a later line is short, without a caller session", async () => {
    const balance = await seedBalance();
    await expect(writeStockMovement(movement({ items: [
      { productId: "product-1", variantId: "variant-1", sku: "SKU-1", productName: "Product 1", quantity: 2 },
      { productId: "product-2", variantId: "variant-2", sku: "SKU-2", productName: "Product 2", quantity: 1 },
    ] }))).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await InventoryBalanceModel.findById(balance._id).lean())?.quantity).toBe(5);
    expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(0);
    expect(await StockLogModel.countDocuments({})).toBe(0);
  });

  it("does not withdraw a sibling variant when the requested SKU has no balance", async () => {
    const balance = await seedBalance("sibling", "OTHER-SKU");
    await expect(writeStockMovement(movement())).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await InventoryBalanceModel.findById(balance._id).lean())?.quantity).toBe(5);
  });

  it("records the matched variant and current average cost when only SKU is supplied", async () => {
    await seedBalance();
    const result = await writeStockMovement(movement({ items: [{ productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 1, unitCost: 999 }] }));
    expect(result.entries[0]).toMatchObject({ variantId: "variant-1", unitCost: 20 });
    expect((await StockLogModel.findOne({ idempotencyKey: "sale-1" }).lean())?.items[0].unitCost).toBe(20);
  });

  it("replays the same movement once and rejects reuse for another branch or quantity", async () => {
    await seedBalance();
    await writeStockMovement(movement());
    expect((await writeStockMovement(movement())).replayed).toBe(true);
    await expect(writeStockMovement(movement({ branchId: "another-branch" }))).rejects.toMatchObject({ status: 409 });
    await expect(writeStockMovement(movement({ items: [{ productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 2 }] }))).rejects.toMatchObject({ status: 409 });
    expect((await InventoryBalanceModel.findOne({ sku: "SKU-1" }).lean())?.quantity).toBe(4);
  });

  it("resets receipt cost when replenishing a previously negative balance", async () => {
    await seedBalance("variant-1", "SKU-1", -2);
    await writeStockMovement(movement({ direction: "in", purpose: "purchase", items: [{ productId: "product-1", variantId: "variant-1", sku: "SKU-1", productName: "Product 1", quantity: 3, unitCost: 5 }] }));
    expect(await InventoryBalanceModel.findOne({ sku: "SKU-1" }).lean()).toMatchObject({ quantity: 1, averageCost: 5 });
  });
});
