import { model, Schema } from "mongoose";

export const customerSourceModules = ["students", "healthcare"] as const;
export type CustomerSourceModule = typeof customerSourceModules[number];

const schema = new Schema({
  companyCode: { type: String, required: true },
  module: { type: String, enum: customerSourceModules, required: true },
  sourceId: { type: String, required: true },
  customerId: { type: String, required: true },
  linkedBy: { type: String, required: true },
  batchId: { type: String },
}, { timestamps: true });

schema.index({ companyCode: 1, module: 1, sourceId: 1 }, { unique: true });
schema.index({ companyCode: 1, customerId: 1 });
schema.index({ companyCode: 1, batchId: 1 });
export const CustomerModuleLinkModel = model("CustomerModuleLink", schema);
