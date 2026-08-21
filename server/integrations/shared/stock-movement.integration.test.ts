import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../model/stock-log.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { writeStockMovement } from "./stock-movement.service";

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
});
