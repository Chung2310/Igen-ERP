import { Document } from "mongoose";

export type ProductCatalogType = "physical" | "service" | "bundle";
export type ProductTrackingMode = "none" | "quantity" | "unit_barcode" | "serial" | "lot";
export interface InventoryTrackingSettings {
  defaultTrackingMode: ProductTrackingMode;
}
export type ProductTemplateFieldType = "text" | "number" | "boolean" | "select" | "multi-select";

export interface ProductTemplateField {
  code: string;
  label: string;
  type: ProductTemplateFieldType;
  required: boolean;
  options: string[];
  unitCode?: string;
}

export interface IProductTemplate extends Document {
  companyCode: string;
  code: string;
  name: string;
  productType: ProductCatalogType;
  fields: ProductTemplateField[];
  status: "active" | "inactive";
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProductCatalog extends Document {
  companyCode: string;
  productCode: string;
  name: string;
  normalizedName: string;
  productType: ProductCatalogType;
  templateCode?: string;
  categoryCode: string;
  brandCode?: string;
  baseUnitCode: string;
  shortDescription?: string;
  description?: string;
  attributes: Array<{ code: string; value: string; unitCode?: string }>;
  searchKeywords: string[];
  countryOfOrigin?: string;
  manufacturer?: string;
  taxCategory?: string;
  status: "draft" | "active" | "inactive" | "archived";
  mediaIds: string[];
  documentIds: string[];
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariantOption {
  code: string;
  value: string;
}

export interface IProductVariant extends Document {
  companyCode: string;
  productId: string;
  sku: string;
  barcode?: string;
  optionValues: ProductVariantOption[];
  displayName?: string;
  unitCode: string;
  trackingMode: ProductTrackingMode;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  warrantyMonths?: number;
  attributes: Array<{ code: string; value: string; unitCode?: string }>;
  mediaIds: string[];
  status: "active" | "inactive" | "discontinued";
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
