import { Schema, model } from "mongoose";
import type { IProductVariant } from "../interface/product-catalog.interface";

const OptionSchema = new Schema({ code: { type: String, required: true, trim: true, uppercase: true }, value: { type: String, required: true, trim: true } }, { _id: false });
const AttributeSchema = new Schema({ code: { type: String, required: true, trim: true, uppercase: true }, value: { type: String, required: true, trim: true }, unitCode: { type: String, trim: true, uppercase: true } }, { _id: false });

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    productId: { type: String, required: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, index: true },
    optionValues: { type: [OptionSchema], default: [] },
    displayName: { type: String, trim: true, maxlength: 200 },
    unitCode: { type: String, required: true, trim: true, uppercase: true },
    trackingMode: { type: String, enum: ["none", "quantity", "unit_barcode", "serial", "lot"], default: "none", required: true },
    weightGrams: { type: Number, min: 0 },
    lengthMm: { type: Number, min: 0 },
    widthMm: { type: Number, min: 0 },
    heightMm: { type: Number, min: 0 },
    warrantyMonths: { type: Number, min: 0, max: 1_200 },
    supplierWarrantyMonths: { type: Number, min: 0, max: 1_200 },
    attributes: { type: [AttributeSchema], default: [] },
    mediaIds: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive", "discontinued"], default: "active", required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

ProductVariantSchema.index({ companyCode: 1, sku: 1 }, { unique: true });
ProductVariantSchema.index({ companyCode: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });
ProductVariantSchema.index({ companyCode: 1, productId: 1, status: 1 });

export const ProductVariantModel = model<IProductVariant>("ProductVariant", ProductVariantSchema);
