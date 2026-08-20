import { model, Schema } from "mongoose";
import { FIXED_ASSET_STATUSES, type IAssetLifecycleEvent, type IFixedAsset } from "../interfaces/asset.interface";

type UpdateDocument = Record<string, unknown>;

const isRecord = (value: unknown): value is UpdateDocument => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const targets = (path: string, field: string) => path === field || path.startsWith(`${field}.`);

/** Rejects replacement/removal of audit history while permitting new events to be appended. */
export function assertFixedAssetLifecycleUpdateAllowed(update: unknown): void {
  const documents = Array.isArray(update) ? update : [update];
  for (const document of documents) {
    if (!isRecord(document)) continue;
    for (const [operator, payload] of Object.entries(document)) {
      if (!operator.startsWith("$") && targets(operator, "lifecycleEvents")) {
        throw new Error("Fixed asset lifecycle history is append-only.");
      }
      if (!isRecord(payload)) continue;
      for (const path of Object.keys(payload)) {
        if (!targets(path, "lifecycleEvents")) continue;
        if (operator === "$push" && path === "lifecycleEvents") continue;
        if (operator === "$setOnInsert" && path === "lifecycleEvents") continue;
        throw new Error("Fixed asset lifecycle history is append-only.");
      }
    }
  }
}

const lifecycleEventSchema = new Schema<IAssetLifecycleEvent>({
  type: { type: String, enum: ["created", "updated", "transferred", "disposed"], required: true },
  at: { type: Date, required: true, default: Date.now },
  by: { type: String, required: true },
  note: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
}, { _id: false });

const schema = new Schema<IFixedAsset>({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  branchId: { type: String, required: true, trim: true },
  assetCode: { type: String, required: true, trim: true },
  barcode: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  group: { type: String, required: true, trim: true },
  originalCost: { type: Number, required: true, min: 0 },
  salvageValue: { type: Number, required: true, min: 0, default: 0 },
  purchaseDate: Date,
  inServiceDate: { type: Date, required: true },
  usefulLifeMonths: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ["straight_line"], default: "straight_line", required: true },
  location: String,
  custodianId: String,
  custodianName: String,
  status: { type: String, enum: FIXED_ASSET_STATUSES, required: true, default: "in_use" },
  accumulatedDepreciation: { type: Number, required: true, min: 0, default: 0 },
  netBookValue: { type: Number, required: true, min: 0 },
  disposedAt: Date,
  disposalAmount: Number,
  disposalReason: String,
  lifecycleEvents: { type: [lifecycleEventSchema], default: [] },
}, { timestamps: true });

schema.index({ companyCode: 1, assetCode: 1 }, { unique: true });
schema.index({ companyCode: 1, barcode: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, status: 1 });

schema.pre("validate", function () {
  if (!this.isNew && this.isModified("lifecycleEvents")) {
    assertFixedAssetLifecycleUpdateAllowed((this as any).getChanges());
  }
});

schema.pre(["findOneAndUpdate", "replaceOne", "updateMany", "updateOne"], function (this: any) {
  assertFixedAssetLifecycleUpdateAllowed(this.getUpdate());
});

export const FixedAssetModel = model<IFixedAsset>("FixedAsset", schema);
