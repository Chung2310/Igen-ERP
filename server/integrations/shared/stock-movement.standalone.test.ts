import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, expect, it } from "vitest";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { writeStockMovement } from "./stock-movement.service";

let server: MongoMemoryServer;
beforeAll(async () => { server = await MongoMemoryServer.create(); await mongoose.connect(server.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

it("rejects stock posting before any mutation when MongoDB cannot transact", async () => {
  const warehouse = await WarehouseModel.create({ companyCode: "TEST", branchId: "branch-1", code: "MAIN", name: "Main", isDefault: true, isActive: true });
  const balance = await InventoryBalanceModel.create({ companyCode: "TEST", branchId: "branch-1", warehouseId: String(warehouse._id), productId: "product-1", sku: "SKU-1", quantity: 5, averageCost: 10 });
  await expect(writeStockMovement({ companyCode: "TEST", branchId: "branch-1", warehouseId: String(warehouse._id), direction: "out", purpose: "sale", sourceType: "test", sourceId: "test-1", idempotencyKey: "test-1", operatorName: "Tester",
    items: [{ productId: "product-1", sku: "SKU-1", productName: "Product 1", quantity: 1 }],
  })).rejects.toMatchObject({ statusCode: 503, code: "INVENTORY_TRANSACTION_REQUIRED" });
  expect((await InventoryBalanceModel.findById(balance._id).lean())?.quantity).toBe(5);
  expect(await InventoryLedgerEntryModel.countDocuments({})).toBe(0);
});
