import assert from "node:assert/strict";
import test from "node:test";
import { RETAIL_PAYMENT_METHODS, RetailOrderModel } from "./retail-order.model";
import { RetailInvoiceModel } from "./retail-invoice.model";
import { RetailIdempotencyModel } from "./retail-idempotency.model";
import { RetailOrderCounterModel } from "./retail-order-counter.model";
import { StockLogModel } from "../../../model/stock-log.model";

test("real payment methods exclude debt", () => {
  assert.deepEqual(RETAIL_PAYMENT_METHODS, ["cash", "card", "transfer", "ewallet"]);
  assert.equal(RETAIL_PAYMENT_METHODS.includes("debt" as any), false);
});

test("order counter is unique by company branch monthly scope", () => {
  assert.ok(RetailOrderCounterModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.branchId === 1 && keys.scope === 1 && options.unique === true));
});

test("idempotency attempt is unique inside a company", () => {
  assert.ok(RetailIdempotencyModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.key === 1 && options.unique === true));
});

test("invoice snapshot schema never defines unitCost", () => {
  assert.equal(RetailInvoiceModel.schema.path("snapshot.items.unitCost"), undefined);
});

test("order payment snapshots carry shift date tender and change", () => {
  for (const path of ["payments.shiftId", "payments.businessDate", "payments.tenderedAmount", "payments.changeAmount", "refunds.shiftId", "refunds.businessDate"]) {
    assert.ok(RetailOrderModel.schema.path(path), `${path} must exist`);
  }
});

test("stock logs expose retail references and unique partial idempotency", () => {
  for (const path of ["refType", "refId", "idempotencyKey"]) assert.ok(StockLogModel.schema.path(path));
  assert.ok(StockLogModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.idempotencyKey === 1 && options.unique === true));
});
