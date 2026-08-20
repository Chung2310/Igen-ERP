import { model, Schema } from "mongoose";
import {
  ASSET_INVENTORY_RESULTS,
  ASSET_INVENTORY_SESSION_STATUSES,
  type IAssetInventoryItem,
  type IAssetInventorySession,
} from "../interfaces/asset.interface";

type UpdateDocument = Record<string, unknown>;

const FROZEN_SESSION_FIELDS = new Set(["companyCode", "sessionCode", "scope", "branchIds", "inventoryDate", "createdBy", "openedAt"]);
const FROZEN_ITEM_FIELDS = new Set(["assetId", "assetCode", "barcode", "name", "expectedBranchId", "expectedLocation", "expectedCustodianId", "expectedCustodianName"]);
const isRecord = (value: unknown): value is UpdateDocument => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const targets = (path: string, field: string) => path === field || path.startsWith(`${field}.`);

const targetsFrozenItemField = (path: string) => path.split(".").some((segment) => FROZEN_ITEM_FIELDS.has(segment));
const replacesItem = (path: string) => /^items\.(?:\$|\$\[[^\]]+\]|\d+)$/.test(path);

/** Allows count-result updates while protecting the opening scope and item snapshots. */
export function assertAssetInventorySessionUpdateAllowed(update: unknown): void {
  const documents = Array.isArray(update) ? update : [update];
  for (const document of documents) {
    if (!isRecord(document)) continue;
    for (const [operator, payload] of Object.entries(document)) {
      if (!operator.startsWith("$")) {
        if ([...FROZEN_SESSION_FIELDS].some((field) => targets(operator, field)) || targets(operator, "items")) {
          throw new Error("Inventory session scope and item snapshots are immutable after creation.");
        }
      }
      if (!isRecord(payload)) continue;
      for (const path of Object.keys(payload)) {
        if ([...FROZEN_SESSION_FIELDS].some((field) => targets(path, field))) {
          if (operator === "$setOnInsert") continue;
          throw new Error("Inventory session scope is immutable after creation.");
        }
        if (!targets(path, "items")) continue;
        if (operator === "$push" && path === "items") continue;
        if (operator === "$setOnInsert" && path === "items") continue;
        if (path === "items" || replacesItem(path) || targetsFrozenItemField(path)) {
          throw new Error("Inventory item snapshots are immutable after creation.");
        }
      }
    }
  }
}

const inventoryItemSchema = new Schema<IAssetInventoryItem>({
  assetId: { type: String, trim: true },
  assetCode: { type: String, required: true, trim: true },
  barcode: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  expectedBranchId: { type: String, required: true, trim: true },
  expectedLocation: { type: String, trim: true },
  expectedCustodianId: { type: String, trim: true },
  expectedCustodianName: { type: String, trim: true },
  result: { type: String, enum: ASSET_INVENTORY_RESULTS, required: true, default: "pending" },
  scannedAt: Date,
  scannedBy: { type: String, trim: true },
  note: { type: String, trim: true },
}, { _id: false });

const schema = new Schema<IAssetInventorySession>({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  sessionCode: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  scope: { type: String, enum: ["company", "branch"], required: true },
  branchIds: { type: [String], required: true },
  inventoryDate: { type: Date, required: true },
  createdBy: { type: String, required: true, trim: true },
  openedAt: { type: Date, required: true },
  finalizedBy: { type: String, trim: true },
  finalizedAt: Date,
  status: { type: String, enum: ASSET_INVENTORY_SESSION_STATUSES, required: true, default: "open" },
  items: { type: [inventoryItemSchema], required: true },
}, { timestamps: true });

schema.index({ companyCode: 1, sessionCode: 1 }, { unique: true });
schema.index({ companyCode: 1, status: 1, inventoryDate: -1 });
schema.index({ companyCode: 1, branchIds: 1, status: 1 });

schema.pre("validate", function () {
  if (!this.isNew && this.isModified()) {
    assertAssetInventorySessionUpdateAllowed((this as any).getChanges());
  }
});

schema.pre(["findOneAndUpdate", "replaceOne", "updateMany", "updateOne"], function (this: any) {
  assertAssetInventorySessionUpdateAllowed(this.getUpdate());
});

export const AssetInventorySessionModel = model<IAssetInventorySession>("AssetInventorySession", schema);
