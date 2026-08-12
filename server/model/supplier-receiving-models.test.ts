import assert from "node:assert/strict";
import test from "node:test";
import { GoodsReceiptModel } from "./goods-receipt.model";
import { SupplierModel } from "./supplier.model";

test("supplier is reusable at company scope", () => {
  assert.ok(SupplierModel.schema.path("companyCode"));
  assert.ok(SupplierModel.schema.path("code"));
  assert.ok(SupplierModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.code === 1 && options.unique === true));
});

test("goods receipt keeps immutable source and confirmation fields", () => {
  for (const field of ["receiptCode", "supplierId", "warehouseId", "items", "status", "version"]) assert.ok(GoodsReceiptModel.schema.path(field));
  assert.ok(GoodsReceiptModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.receiptCode === 1 && options.unique === true));
  assert.ok(GoodsReceiptModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.idempotencyKey === 1 && options.unique === true));
});
