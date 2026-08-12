import { Document } from "mongoose";

export type ProductCatalogResourceStatus = "active" | "inactive";
export type ProductAttributeDefinitionType = "text" | "number" | "boolean" | "select" | "multi-select";

export interface IProductCatalogCategory extends Document {
  companyCode: string;
  code: string;
  name: string;
  normalizedName: string;
  parentCode?: string;
  description?: string;
  status: ProductCatalogResourceStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProductCatalogBrand extends Document {
  companyCode: string;
  code: string;
  name: string;
  normalizedName: string;
  description?: string;
  website?: string;
  logoMediaId?: string;
  status: ProductCatalogResourceStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUnitOfMeasure extends Document {
  companyCode: string;
  code: string;
  name: string;
  symbol?: string;
  category: "count" | "weight" | "volume" | "length" | "time" | "other";
  decimalPlaces: number;
  baseUnitCode?: string;
  conversionFactor?: number;
  status: ProductCatalogResourceStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProductAttributeDefinition extends Document {
  companyCode: string;
  code: string;
  name: string;
  type: ProductAttributeDefinitionType;
  options: string[];
  unitCode?: string;
  status: ProductCatalogResourceStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

