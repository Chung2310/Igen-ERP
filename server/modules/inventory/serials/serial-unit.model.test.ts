import assert from "node:assert/strict";
import test from "node:test";
import { SerialUnitModel } from "./serial-unit.model";

test("serial registry is tenant unique and status scoped", () => {
  assert.ok(SerialUnitModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.normalizedSerialNumber === 1 && options.unique === true));
  assert.ok(SerialUnitModel.schema.path("status"));
  assert.ok(SerialUnitModel.schema.path("branchId"));
});
