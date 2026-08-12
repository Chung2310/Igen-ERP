import { Schema, model } from "mongoose";
import type { IProductCatalog } from "../interface/product-catalog.interface";

const AttributeSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    value: { type: String, required: true, trim: true },
    unitCode: { type: String, trim: true, uppercase: true },
  },
  { _id: false },
);

const ProductCatalogSchema = new Schema<IProductCatalog>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    productCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, index: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, index: true },
    productType: { type: String, enum: ["physical", "service", "bundle"], required: true },
    templateCode: { type: String, trim: true, uppercase: true, index: true },
    categoryCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    brandCode: { type: String, trim: true, uppercase: true, index: true },
    baseUnitCode: { type: String, required: true, trim: true, uppercase: true },
    shortDescription: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 20_000 },
    attributes: { type: [AttributeSchema], default: [] },
    searchKeywords: { type: [String], default: [] },
    countryOfOrigin: { type: String, trim: true, maxlength: 120 },
    manufacturer: { type: String, trim: true, maxlength: 200 },
    taxCategory: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: ["draft", "active", "inactive", "archived"], default: "draft", required: true },
    mediaIds: { type: [String], default: [] },
    documentIds: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

ProductCatalogSchema.index({ companyCode: 1, productCode: 1 }, { unique: true });
ProductCatalogSchema.index({ companyCode: 1, normalizedName: 1 });

export const ProductCatalogModel = model<IProductCatalog>("ProductCatalog", ProductCatalogSchema);
