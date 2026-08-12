import { Schema, model } from "mongoose";
import type { IProductCatalogLegacyMapping } from "../interface/product-catalog-legacy-mapping.interface";

const ProductCatalogLegacyMappingSchema = new Schema<IProductCatalogLegacyMapping>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    legacyProductId: { type: String, required: true, index: true },
    legacyBranchId: { type: String, index: true },
    productId: { type: String, required: true, index: true },
    variantId: { type: String, required: true, index: true },
    migratedAt: { type: Date, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

ProductCatalogLegacyMappingSchema.index({ companyCode: 1, legacyProductId: 1 }, { unique: true });
ProductCatalogLegacyMappingSchema.index({ companyCode: 1, variantId: 1 });

export const ProductCatalogLegacyMappingModel = model<IProductCatalogLegacyMapping>("ProductCatalogLegacyMapping", ProductCatalogLegacyMappingSchema);

