import { Schema, model } from "mongoose";

const ProductPriceSchema = new Schema({
  companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
  branchId: { type: String, required: true, trim: true, index: true },
  productId: { type: String, required: true, trim: true, index: true },
  variantId: { type: String, required: true, trim: true, index: true },
  sku: { type: String, required: true, trim: true, uppercase: true, index: true },
  sellingPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

ProductPriceSchema.index({ companyCode: 1, branchId: 1, variantId: 1 }, { unique: true });

export const ProductPriceModel = model("ProductPrice", ProductPriceSchema);
