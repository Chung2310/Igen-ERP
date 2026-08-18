import assert from "node:assert/strict";
import test from "node:test";
import { RepairPartModel } from "./repair-part.model";

test("repair part schema enforces idempotent issuance", () => {
  assert.ok(RepairPartModel.schema.path("idempotencyKey"));
  assert.ok(RepairPartModel.schema.indexes().some(([fields, options]) => fields.companyCode && fields.idempotencyKey && options?.unique));
});
