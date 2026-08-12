import { Schema, model } from "mongoose";
import type {
  IProductAttributeDefinition,
  IProductCatalogBrand,
  IProductCatalogCategory,
  IUnitOfMeasure,
} from "../interface/product-catalog-resource.interface";

const auditFields = {
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
};

const ProductCatalogCategorySchema = new Schema<IProductCatalogCategory>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    parentCode: { type: String, trim: true, uppercase: true },
    description: { type: String, trim: true, maxlength: 2_000 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    ...auditFields,
  },
  { timestamps: true },
);
ProductCatalogCategorySchema.index({ companyCode: 1, code: 1 }, { unique: true });
ProductCatalogCategorySchema.index({ companyCode: 1, normalizedName: 1 });

const ProductCatalogBrandSchema = new Schema<IProductCatalogBrand>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 2_000 },
    website: { type: String, trim: true, maxlength: 500 },
    logoMediaId: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    ...auditFields,
  },
  { timestamps: true },
);
ProductCatalogBrandSchema.index({ companyCode: 1, code: 1 }, { unique: true });
ProductCatalogBrandSchema.index({ companyCode: 1, normalizedName: 1 });

const UnitOfMeasureSchema = new Schema<IUnitOfMeasure>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, trim: true, maxlength: 20 },
    category: { type: String, enum: ["count", "weight", "volume", "length", "time", "other"], required: true },
    decimalPlaces: { type: Number, min: 0, max: 6, default: 0, required: true },
    baseUnitCode: { type: String, trim: true, uppercase: true },
    conversionFactor: { type: Number, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    ...auditFields,
  },
  { timestamps: true },
);
UnitOfMeasureSchema.index({ companyCode: 1, code: 1 }, { unique: true });

const ProductAttributeDefinitionSchema = new Schema<IProductAttributeDefinition>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "number", "boolean", "select", "multi-select"], required: true },
    options: { type: [String], default: [] },
    unitCode: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    ...auditFields,
  },
  { timestamps: true },
);
ProductAttributeDefinitionSchema.index({ companyCode: 1, code: 1 }, { unique: true });

export const ProductCatalogCategoryModel = model<IProductCatalogCategory>("ProductCatalogCategory", ProductCatalogCategorySchema);
export const ProductCatalogBrandModel = model<IProductCatalogBrand>("ProductCatalogBrand", ProductCatalogBrandSchema);
export const UnitOfMeasureModel = model<IUnitOfMeasure>("UnitOfMeasure", UnitOfMeasureSchema);
export const ProductAttributeDefinitionModel = model<IProductAttributeDefinition>("ProductAttributeDefinition", ProductAttributeDefinitionSchema);

