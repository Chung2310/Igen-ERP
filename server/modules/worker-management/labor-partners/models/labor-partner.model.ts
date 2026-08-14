import mongoose, { Schema, type Model } from "mongoose";
import type { ILaborPartner } from "../interfaces/labor-partner.interface";

const schema = new Schema<ILaborPartner>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: "" },
  taxCode: { type: String, trim: true, default: "" },
  representative: { type: String, trim: true, default: "" },
  address: { type: String, trim: true, default: "" },
  bankName: { type: String, trim: true, default: "" },
  bankAccountNo: { type: String, trim: true, default: "" },
  bankAccountName: { type: String, trim: true, default: "" },
  defaultPolicyId: { type: Schema.Types.ObjectId, ref: "LaborPartnerCommissionPolicy", default: null },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  note: { type: String, trim: true, default: "" },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, code: 1, deletedAt: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
schema.index({ companyCode: 1, branchId: 1, status: 1, name: 1 });

export const LaborPartnerModel: Model<ILaborPartner> = (mongoose.models.LaborPartner as Model<ILaborPartner> | undefined) || mongoose.model<ILaborPartner>("LaborPartner", schema);
