import { model, Schema } from "mongoose";
import { ASSET_DEPRECIATION_STATUSES, type IAssetDepreciation } from "../interfaces/asset.interface";

const schema = new Schema<IAssetDepreciation>({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  branchId: { type: String, required: true, trim: true },
  assetId: { type: String, required: true, trim: true },
  period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  amount: { type: Number, required: true, min: 0 },
  accumulatedAfter: { type: Number, required: true, min: 0 },
  netBookValueAfter: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ASSET_DEPRECIATION_STATUSES, required: true, default: "planned" },
  postedAt: Date,
  postedBy: String,
}, { timestamps: true });

schema.index({ assetId: 1, period: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, period: 1, status: 1 });

export const AssetDepreciationModel = model<IAssetDepreciation>("AssetDepreciation", schema);
