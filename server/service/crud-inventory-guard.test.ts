import assert from "node:assert/strict";
import test from "node:test";
import { assertNoLegacyInventoryMutation } from "./crud-inventory-guard";

test("legacy product stock cannot be edited through generic CRUD", () => {
  assert.throws(() => assertNoLegacyInventoryMutation("products", { stock: 10 }), (error: any) => error.statusCode === 403 && /phiếu kho/i.test(error.message));
  assert.doesNotThrow(() => assertNoLegacyInventoryMutation("products", { name: "Tên mới" }));
});

test("legacy stock log is integrated with the new stock movement system", () => {
  assert.doesNotThrow(() => assertNoLegacyInventoryMutation("stock-logs", { notes: "sửa" }));
});
