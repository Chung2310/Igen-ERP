import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ASSET_DEPRECIATION_STATUSES,
  ASSET_INVENTORY_RESULTS,
  ASSET_INVENTORY_SESSION_STATUSES,
  FIXED_ASSET_STATUSES,
} from "./interfaces/asset.interface";
import { AssetDepreciationModel } from "./models/asset-depreciation.model";
import { AssetInventorySessionModel, assertAssetInventorySessionUpdateAllowed } from "./models/asset-inventory.model";
import { FixedAssetModel, assertFixedAssetLifecycleUpdateAllowed } from "./models/fixed-asset.model";

const hasUniqueIndex = (model: typeof FixedAssetModel, keys: Record<string, number>) => (
  model.schema.indexes().some(([actual, options]: any) => (
    Object.entries(keys).every(([key, value]) => actual[key] === value) && options.unique === true
  ))
);

test("fixed assets keep codes and barcodes unique within a company", () => {
  assert.ok(hasUniqueIndex(FixedAssetModel, { companyCode: 1, assetCode: 1 }));
  assert.ok(hasUniqueIndex(FixedAssetModel, { companyCode: 1, barcode: 1 }));
  assert.deepEqual((FixedAssetModel.schema.path("status") as any).enumValues, FIXED_ASSET_STATUSES);
  assert.deepEqual((FixedAssetModel.schema.path("method") as any).enumValues, ["straight_line"]);

  const lifecycleEvent = (FixedAssetModel.schema.path("lifecycleEvents") as any).schema;
  assert.equal(lifecycleEvent.path("type").isRequired, true);
  assert.equal(lifecycleEvent.path("at").isRequired, true);
  assert.equal(lifecycleEvent.path("by").isRequired, true);
});

test("fixed asset lifecycle history permits append-only updates", () => {
  const event = { type: "updated", at: new Date(), by: "user-1" };
  assert.doesNotThrow(() => assertFixedAssetLifecycleUpdateAllowed({ $push: { lifecycleEvents: event } }));
  for (const update of [
    { $set: { lifecycleEvents: [] } },
    { $set: { "lifecycleEvents.0.note": "rewritten" } },
    { $pull: { lifecycleEvents: { type: "updated" } } },
    { lifecycleEvents: [] },
  ]) {
    assert.throws(() => assertFixedAssetLifecycleUpdateAllowed(update), /append-only/i);
  }
});

test("depreciation rows are idempotent per asset and accounting period", () => {
  assert.ok(hasUniqueIndex(AssetDepreciationModel as any, { assetId: 1, period: 1 }));
  assert.equal((AssetDepreciationModel.schema.path("period") as any).isRequired, true);
  assert.deepEqual((AssetDepreciationModel.schema.path("status") as any).enumValues, ASSET_DEPRECIATION_STATUSES);
  for (const field of ["companyCode", "assetId", "amount", "accumulatedAfter", "netBookValueAfter"]) {
    assert.equal((AssetDepreciationModel.schema.path(field) as any).isRequired, true, `${field} must be required`);
  }
});

test("inventory sessions persist immutable asset snapshots and result states", () => {
  const schema = AssetInventorySessionModel.schema;
  assert.deepEqual((schema.path("status") as any).enumValues, ASSET_INVENTORY_SESSION_STATUSES);
  assert.deepEqual((schema.path("scope") as any).enumValues, ["company", "branch"]);
  for (const field of ["companyCode", "sessionCode", "name", "branchIds", "inventoryDate", "createdBy", "openedAt", "items"]) {
    assert.equal((schema.path(field) as any).isRequired, true, `${field} must be required`);
  }

  const item = (schema.path("items") as any).schema;
  assert.notEqual(item.path("assetId").isRequired, true, "surplus items have no matched asset");
  for (const field of ["assetCode", "barcode", "name", "expectedBranchId", "result"]) {
    assert.equal(item.path(field).isRequired, true, `${field} must be stored in the snapshot`);
  }
  assert.deepEqual(item.path("result").enumValues, ASSET_INVENTORY_RESULTS);
  for (const field of ["expectedLocation", "expectedCustodianId", "expectedCustodianName", "scannedAt", "scannedBy", "note"]) {
    assert.notEqual(item.path(field).isRequired, true, `${field} is optional`);
  }
});

test("inventory session guards freeze scope and snapshots while allowing count results", () => {
  assert.doesNotThrow(() => assertAssetInventorySessionUpdateAllowed({
    $set: { "items.$.result": "present", "items.$.scannedAt": new Date(), "items.$.scannedBy": "user-1", status: "finalized" },
  }));
  assert.doesNotThrow(() => assertAssetInventorySessionUpdateAllowed({
    $push: { items: { assetCode: "SURPLUS-1", barcode: "SURPLUS-1", name: "Unmatched asset", expectedBranchId: "B1", result: "surplus" } },
  }));

  for (const update of [
    { $set: { companyCode: "OTHER" } },
    { $set: { scope: "branch" } },
    { $push: { branchIds: "B2" } },
    { $set: { "items.$.assetCode": "REPLACED" } },
    { $unset: { "items.$.expectedCustodianId": 1 } },
    { $pull: { items: { result: "missing" } } },
  ]) {
    assert.throws(() => assertAssetInventorySessionUpdateAllowed(update), /immutable/i);
  }
});
