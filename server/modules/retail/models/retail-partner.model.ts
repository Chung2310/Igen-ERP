import { model, Schema } from "mongoose";

export const RETAIL_PARTNER_ROLES = ["collaborator", "dealer", "supplier"] as const;

export interface RetailPartner {
  companyCode: string;
  code: string;
  name: string;
  roles: (typeof RETAIL_PARTNER_ROLES)[number][];
  phone?: string;
  email?: string;
  address?: string;
  status: "active" | "inactive";
  userId?: string;
  supplierId?: string;
  createdBy: string;
  updatedBy: string;
}

const schema = new Schema<RetailPartner>({
  companyCode: { type: String, required: true, trim: true, uppercase: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  roles: { type: [{ type: String, enum: RETAIL_PARTNER_ROLES }], required: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  userId: String,
  supplierId: String,
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } });
schema.index({ companyCode: 1, supplierId: 1 }, { unique: true, partialFilterExpression: { supplierId: { $type: "string" } } });
schema.index({ companyCode: 1, roles: 1, status: 1, name: 1 });

export const RetailPartnerModel = model<RetailPartner>("RetailPartner", schema);
