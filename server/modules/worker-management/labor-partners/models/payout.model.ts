import mongoose, { Schema } from "mongoose";

const actorSchema = new Schema({ id: String, name: String, email: String }, { _id: false });
const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "LaborPartner", required: true, index: true },
  settlementId: { type: Schema.Types.ObjectId, ref: "LaborPartnerSettlement", required: true, index: true },
  amount: { type: Number, required: true },
  paidAt: { type: Date, required: true },
  method: { type: String, enum: ["cash", "bank_transfer"], required: true },
  reference: { type: String, default: "" },
  note: { type: String, default: "" },
  idempotencyKey: { type: String, required: true },
  createdBy: { type: actorSchema, required: true },
  reversalOfPayoutId: { type: Schema.Types.ObjectId, default: null, index: true },
}, { timestamps: true });

schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ settlementId: 1, paidAt: -1 });

export const LaborPartnerPayoutModel = (mongoose.models.LaborPartnerPayout as mongoose.Model<any> | undefined) || mongoose.model("LaborPartnerPayout", schema);
