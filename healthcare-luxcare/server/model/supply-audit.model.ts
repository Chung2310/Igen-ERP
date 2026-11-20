import { Schema, model } from "mongoose";
const schema = new Schema(
  {
    companyCode: { type: String, required: true },
    branchId: String,
    supplyId: { type: String, required: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  { timestamps: true },
);
schema.index({ companyCode: 1, supplyId: 1, createdAt: -1 });
export const SupplyAuditModel = model("SupplyAudit", schema);
