import assert from "node:assert/strict";
import test from "node:test";
import { InventoryBalanceModel } from "./inventory-balance.model";
import { InventoryLedgerEntryModel } from "./inventory-ledger-entry.model";
import { ProductVariantModel } from "./product-variant.model";
import { WarehouseModel } from "./warehouse.model";

test("warehouse is scoped by company and branch with one default warehouse", () => {
  assert.ok(WarehouseModel.schema.path("companyCode"));
  assert.ok(WarehouseModel.schema.path("branchId"));
  assert.ok(WarehouseModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.branchId === 1 && keys.isDefault === 1 && options.unique === true));
});

test("inventory balance is unique per warehouse and product variant", () => {
  assert.ok(InventoryBalanceModel.schema.path("quantity"));
  assert.ok(InventoryBalanceModel.schema.path("reservedQuantity"));
  assert.ok(InventoryBalanceModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.warehouseId === 1 && keys.productId === 1 && keys.variantId === 1 && options.unique === true));
});

test("inventory ledger stores signed movement and database idempotency key", () => {
  assert.ok(InventoryLedgerEntryModel.schema.path("quantityDelta"));
  assert.ok(InventoryLedgerEntryModel.schema.path("sourceLine"));
  assert.ok(InventoryLedgerEntryModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.idempotencyKey === 1 && keys.sourceLine === 1 && options.unique === true));
});

test("product variants default to untracked and only expose supported tracking modes", () => {
  const trackingMode = ProductVariantModel.schema.path("trackingMode") as any;
  assert.equal(trackingMode.defaultValue, "none");
  assert.deepEqual(trackingMode.enumValues, ["none", "quantity", "serial", "lot"]);
});
