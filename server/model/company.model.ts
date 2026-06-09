import { Schema, model } from "mongoose";
import { ICompany } from "../interface/company.interface";

const CompanySchema = new Schema<ICompany>({
  code: { type: String, required: true, unique: true, index: true, uppercase: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  ownerEmail: { type: String, required: true },
});

export const CompanyModel = model<ICompany>("Company", CompanySchema);
