import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    companyCode: { type: String, required: true },
    key: { type: String, required: true },
    fingerprint: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
schema.index({ companyCode: 1, key: 1 }, { unique: true });
// No TTL: removing a completed operation would permit replaying old requests.
export const SupplyOperationModel = model("SupplyOperation", schema);
