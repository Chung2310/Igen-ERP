import type { Model } from "mongoose";
import {
  ProductAttributeDefinitionModel,
  ProductCatalogBrandModel,
  ProductCatalogCategoryModel,
  UnitOfMeasureModel,
} from "../../../model/product-catalog-resource.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import type {
  IProductAttributeDefinition,
  IProductCatalogBrand,
  IProductCatalogCategory,
  IUnitOfMeasure,
  ProductAttributeDefinitionType,
} from "../../../interface/product-catalog-resource.interface";
import {
  ProductCatalogValidationError,
  normalizeCode,
  normalizeCompanyCode,
  normalizeName,
  resolveNextCatalogCode,
} from "./product-catalog.service";

export type ProductCatalogResourceKind = "categories" | "brands" | "units" | "attributes";
type ResourceDocument = IProductCatalogCategory | IProductCatalogBrand | IUnitOfMeasure | IProductAttributeDefinition;

const models: Record<ProductCatalogResourceKind, Model<any>> = {
  categories: ProductCatalogCategoryModel,
  brands: ProductCatalogBrandModel,
  units: UnitOfMeasureModel,
  attributes: ProductAttributeDefinitionModel,
};

const RESOURCE_KINDS = Object.keys(models) as ProductCatalogResourceKind[];
const RESOURCE_CODE_PREFIX: Record<ProductCatalogResourceKind, string> = {
  categories: "CAT",
  brands: "BRAND",
  units: "UOM",
  attributes: "ATTR",
};

export function assertResourceKind(value: unknown): asserts value is ProductCatalogResourceKind {
  if (!RESOURCE_KINDS.includes(value as ProductCatalogResourceKind)) throw new ProductCatalogValidationError("Loại resource sản phẩm không hợp lệ.");
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ProductCatalogValidationError(`${field} không được vượt quá ${maxLength} ký tự.`);
  return text;
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError(`${field} phải là một mảng.`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function status(value: unknown): "active" | "inactive" {
  if (value === undefined || value === null || value === "") return "active";
  if (value !== "active" && value !== "inactive") throw new ProductCatalogValidationError("Trạng thái resource không hợp lệ.");
  return value;
}

function normalizeResourceInput(kind: ProductCatalogResourceKind, input: any, actor: string): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Dữ liệu resource không hợp lệ.");
  const base = {
    code: normalizeCode(input.code, "Mã resource"),
    name: normalizeName(input.name, "Tên resource"),
    normalizedName: normalizeName(input.name, "Tên resource").toLocaleLowerCase("vi-VN"),
    status: status(input.status),
    createdBy: actor,
    updatedBy: actor,
  };
  if (kind === "categories") {
    return {
      ...base,
      parentCode: input.parentCode ? normalizeCode(input.parentCode, "Mã danh mục cha") : undefined,
      description: optionalText(input.description, "Mô tả", 2_000),
    };
  }
  if (kind === "brands") {
    return {
      ...base,
      description: optionalText(input.description, "Mô tả", 2_000),
      website: optionalText(input.website, "Website", 500),
      logoMediaId: optionalText(input.logoMediaId, "ID logo", 200),
    };
  }
  if (kind === "units") {
    const categories = ["count", "weight", "volume", "length", "time", "other"];
    if (!categories.includes(input.category)) throw new ProductCatalogValidationError("Nhóm đơn vị tính không hợp lệ.");
    const decimalPlaces = Number(input.decimalPlaces ?? 0);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) throw new ProductCatalogValidationError("decimalPlaces phải là số nguyên từ 0 đến 6.");
    const conversionFactor = input.conversionFactor === undefined || input.conversionFactor === "" ? undefined : Number(input.conversionFactor);
    if (conversionFactor !== undefined && (!Number.isFinite(conversionFactor) || conversionFactor <= 0)) throw new ProductCatalogValidationError("conversionFactor pháº£i lá»›n hÆ¡n 0.");
    if (input.baseUnitCode && conversionFactor === undefined) throw new ProductCatalogValidationError("Đơn vị quy đổi phải có conversionFactor.");
    return {
      ...base,
      symbol: optionalText(input.symbol, "Ký hiệu", 20),
      category: input.category,
      decimalPlaces,
      baseUnitCode: input.baseUnitCode ? normalizeCode(input.baseUnitCode, "Mã đơn vị gốc") : undefined,
      conversionFactor,
    };
  }
  const types: ProductAttributeDefinitionType[] = ["text", "number", "boolean", "select", "multi-select"];
  if (!types.includes(input.type)) throw new ProductCatalogValidationError("Kiểu thuộc tính không hợp lệ.");
  const options = stringArray(input.options, "options");
  if ((input.type === "select" || input.type === "multi-select") && options.length === 0) throw new ProductCatalogValidationError("Thuộc tính dạng lựa chọn phải có options.");
  return {
    ...base,
    type: input.type,
    options,
    unitCode: input.unitCode ? normalizeCode(input.unitCode, "Mã đơn vị của thuộc tính") : undefined,
  };
}

export const ProductCatalogResourceService = {
  async list(companyCodeValue: unknown, kindValue: unknown, query: Record<string, unknown> = {}) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    const filter: Record<string, unknown> = { companyCode };
    if (query.status === "active" || query.status === "inactive") filter.status = query.status;
    const search = String(query.q || "").trim();
    if (search) filter.$or = [{ code: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
    return models[kindValue].find(filter).sort({ name: 1 }).limit(200).lean();
  },

  async create(companyCodeValue: unknown, kindValue: unknown, input: unknown, actorValue: unknown): Promise<ResourceDocument> {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    const actor = String(actorValue || "").trim();
    if (!actor) throw new ProductCatalogValidationError("Không xác định được người thực hiện thao tác.");
    const raw = input as Record<string, unknown>;
    const code = raw?.code ? normalizeCode(raw.code, "Mã resource") : await resolveNextCatalogCode(models[kindValue], companyCode, RESOURCE_CODE_PREFIX[kindValue], raw?.name);
    const document = await models[kindValue].create({ companyCode, ...normalizeResourceInput(kindValue, { ...raw, code }, actor) });
    return document.toObject() as ResourceDocument;
  },

  async update(companyCodeValue: unknown, kindValue: unknown, id: string, input: unknown, actorValue: unknown): Promise<ResourceDocument> {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    const actor = String(actorValue || "").trim();
    if (!actor) throw new ProductCatalogValidationError("Không xác định được người thực hiện thao tác.");
    const current = await models[kindValue].findOne({ _id: id, companyCode });
    if (!current) throw Object.assign(new Error("Không tìm thấy dữ liệu dùng chung."), { statusCode: 404 });
    const raw = input as Record<string, unknown>;
    if (raw?.code && String(raw.code).trim().toUpperCase() !== String(current.code).toUpperCase()) {
      throw new ProductCatalogValidationError("Mã đã được hệ thống cấp, không thể thay đổi.");
    }
    const normalized = normalizeResourceInput(kindValue, { ...current.toObject(), ...raw, code: current.code }, actor);
    delete normalized.createdBy;
    const document = await models[kindValue].findOneAndUpdate({ _id: id, companyCode }, { $set: normalized }, { returnDocument: "after", runValidators: true });
    if (!document) throw Object.assign(new Error("Không tìm thấy dữ liệu dùng chung."), { statusCode: 404 });
    return document.toObject() as ResourceDocument;
  },

  async delete(companyCodeValue: unknown, kindValue: unknown, id: string): Promise<{ deletedId: string }> {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    if (kindValue !== "categories" && kindValue !== "brands") {
      throw new ProductCatalogValidationError("Chỉ có thể xóa danh mục hoặc thương hiệu.");
    }
    const current = await models[kindValue].findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("Không tìm thấy dữ liệu dùng chung."), { statusCode: 404 });

    const productFilter = kindValue === "categories" ? { categoryCode: current.code } : { brandCode: current.code };
    const inUse = await ProductCatalogModel.exists({ companyCode, ...productFilter });
    if (inUse) {
      throw new ProductCatalogValidationError(`Không thể xóa ${kindValue === "categories" ? "danh mục" : "thương hiệu"} đang được dùng bởi sản phẩm.`);
    }
    await models[kindValue].deleteOne({ _id: id, companyCode });
    return { deletedId: id };
  },
};
