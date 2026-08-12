import { Schema, model } from "mongoose";
import type { IProductTemplate } from "../interface/product-catalog.interface";

const ProductTemplateFieldSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "number", "boolean", "select", "multi-select"], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    unitCode: { type: String, trim: true },
  },
  { _id: false },
);

const ProductTemplateSchema = new Schema<IProductTemplate>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    productType: { type: String, enum: ["physical", "service", "bundle"], required: true },
    fields: { type: [ProductTemplateFieldSchema], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

ProductTemplateSchema.index({ companyCode: 1, code: 1 }, { unique: true });

export const ProductTemplateModel = model<IProductTemplate>("ProductTemplate", ProductTemplateSchema);
