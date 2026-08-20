import assert from "node:assert/strict";
import test from "node:test";
import { FixedAssetModel } from "./fixed-asset.model";

test("fixed asset model protects company-local codes and barcodes", () => {
  const indexes = FixedAssetModel.schema.indexes();
  const hasUnique = (keys: Record<string, number>) => indexes.some(([actual, options]: any) => Object.entries(keys).every(([key, value]) => actual[key] === value) && options.unique === true);
  assert.ok(hasUnique({ companyCode: 1, assetCode: 1 }));
  assert.ok(hasUnique({ companyCode: 1, barcode: 1 }));
  assert.deepEqual((FixedAssetModel.schema.path("status") as any).enumValues, ["in_use", "idle", "disposed"]);
});
