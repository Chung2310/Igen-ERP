import { Document } from "mongoose";

export interface IProductCatalogLegacyMapping extends Document {
  companyCode: string;
  legacyProductId: string;
  legacyBranchId?: string;
  productId: string;
  variantId: string;
  migratedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

