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
  if (!RESOURCE_KINDS.includes(value as ProductCatalogResourceKind)) throw new ProductCatalogValidationError("Loáº¡i resource sáº£n pháº©m khÃ´ng há»£p lá»‡.");
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ProductCatalogValidationError(`${field} khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ ${maxLength} kÃ½ tá»±.`);
  return text;
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError(`${field} pháº£i lÃ  má»™t máº£ng.`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function status(value: unknown): "active" | "inactive" {
  if (value === undefined || value === null || value === "") return "active";
  if (value !== "active" && value !== "inactive") throw new ProductCatalogValidationError("Tráº¡ng thÃ¡i resource khÃ´ng há»£p lá»‡.");
  return value;
}

function normalizeResourceInput(kind: ProductCatalogResourceKind, input: any, actor: string): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Dá»¯ liá»‡u resource khÃ´ng há»£p lá»‡.");
  const base = {
    code: normalizeCode(input.code, "MÃ£ resource"),
    name: normalizeName(input.name, "TÃªn resource"),
    normalizedName: normalizeName(input.name, "TÃªn resource").toLocaleLowerCase("vi-VN"),
    status: status(input.status),
    createdBy: actor,
    updatedBy: actor,
  };
  if (kind === "categories") {
    return {
      ...base,
      parentCode: input.parentCode ? normalizeCode(input.parentCode, "MÃ£ danh má»¥c cha") : undefined,
      description: optionalText(input.description, "MÃ´ táº£", 2_000),
    };
  }
  if (kind === "brands") {
    return {
      ...base,
      description: optionalText(input.description, "MÃ´ táº£", 2_000),
      website: optionalText(input.website, "Website", 500),
      logoMediaId: optionalText(input.logoMediaId, "ID logo", 200),
    };
  }
  if (kind === "units") {
    const categories = ["count", "weight", "volume", "length", "time", "other"];
    if (!categories.includes(input.category)) throw new ProductCatalogValidationError("NhÃ³m Ä‘Æ¡n vá»‹ tÃ­nh khÃ´ng há»£p lá»‡.");
    const decimalPlaces = Number(input.decimalPlaces ?? 0);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) throw new ProductCatalogValidationError("decimalPlaces pháº£i lÃ  sá»‘ nguyÃªn tá»« 0 Ä‘áº¿n 6.");
    const conversionFactor = input.conversionFactor === undefined || input.conversionFactor === "" ? undefined : Number(input.conversionFactor);
    if (conversionFactor !== undefined && (!Number.isFinite(conversionFactor) || conversionFactor <= 0)) throw new ProductCatalogValidationError("conversionFactor pháº£i lá»›n hÆ¡n 0.");
    if (input.baseUnitCode && conversionFactor === undefined) throw new ProductCatalogValidationError("ÄÆ¡n vá»‹ quy Ä‘á»•i pháº£i cÃ³ conversionFactor.");
    return {
      ...base,
      symbol: optionalText(input.symbol, "KÃ½ hiá»‡u", 20),
      category: input.category,
      decimalPlaces,
      baseUnitCode: input.baseUnitCode ? normalizeCode(input.baseUnitCode, "MÃ£ Ä‘Æ¡n vá»‹ gá»‘c") : undefined,
      conversionFactor,
    };
  }
  const types: ProductAttributeDefinitionType[] = ["text", "number", "boolean", "select", "multi-select"];
  if (!types.includes(input.type)) throw new ProductCatalogValidationError("Kiá»ƒu thuá»™c tÃ­nh khÃ´ng há»£p lá»‡.");
  const options = stringArray(input.options, "options");
  if ((input.type === "select" || input.type === "multi-select") && options.length === 0) throw new ProductCatalogValidationError("Thuá»™c tÃ­nh dáº¡ng lá»±a chá»n pháº£i cÃ³ options.");
  return {
    ...base,
    type: input.type,
    options,
    unitCode: input.unitCode ? normalizeCode(input.unitCode, "MÃ£ Ä‘Æ¡n vá»‹ cá»§a thuá»™c tÃ­nh") : undefined,
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
    if (!actor) throw new ProductCatalogValidationError("KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c ngÆ°á»i thá»±c hiá»‡n thao tÃ¡c.");
    const raw = input as Record<string, unknown>;
    const code = raw?.code ? normalizeCode(raw.code, "MÃ£ resource") : await resolveNextCatalogCode(models[kindValue], companyCode, RESOURCE_CODE_PREFIX[kindValue], raw?.name);
    const document = await models[kindValue].create({ companyCode, ...normalizeResourceInput(kindValue, { ...raw, code }, actor) });
    return document.toObject() as ResourceDocument;
  },

  async update(companyCodeValue: unknown, kindValue: unknown, id: string, input: unknown, actorValue: unknown): Promise<ResourceDocument> {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    const actor = String(actorValue || "").trim();
    if (!actor) throw new ProductCatalogValidationError("KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c ngÆ°á»i thá»±c hiá»‡n thao tÃ¡c.");
    const current = await models[kindValue].findOne({ _id: id, companyCode });
    if (!current) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u dÃ¹ng chung."), { statusCode: 404 });
    const raw = input as Record<string, unknown>;
    if (raw?.code && String(raw.code).trim().toUpperCase() !== String(current.code).toUpperCase()) {
      throw new ProductCatalogValidationError("MÃ£ Ä‘Ã£ Ä‘Æ°á»£c há»‡ thá»‘ng cáº¥p, khÃ´ng thá»ƒ thay Ä‘á»•i.");
    }
    const normalized = normalizeResourceInput(kindValue, { ...current.toObject(), ...raw, code: current.code }, actor);
    delete normalized.createdBy;
    const document = await models[kindValue].findOneAndUpdate({ _id: id, companyCode }, { $set: normalized }, { returnDocument: "after", runValidators: true });
    if (!document) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u dÃ¹ng chung."), { statusCode: 404 });
    return document.toObject() as ResourceDocument;
  },

  async delete(companyCodeValue: unknown, kindValue: unknown, id: string): Promise<{ deletedId: string }> {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertResourceKind(kindValue);
    if (kindValue !== "categories" && kindValue !== "brands") {
      throw new ProductCatalogValidationError("Chá»‰ cÃ³ thá»ƒ xÃ³a danh má»¥c hoáº·c thÆ°Æ¡ng hiá»‡u.");
    }
    const current = await models[kindValue].findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u dÃ¹ng chung."), { statusCode: 404 });

    const productFilter = kindValue === "categories" ? { categoryCode: current.code } : { brandCode: current.code };
    const inUse = await ProductCatalogModel.exists({ companyCode, ...productFilter });
    if (inUse) {
      throw new ProductCatalogValidationError(`KhÃ´ng thá»ƒ xÃ³a ${kindValue === "categories" ? "danh má»¥c" : "thÆ°Æ¡ng hiá»‡u"} Ä‘ang Ä‘Æ°á»£c dÃ¹ng bá»Ÿi sáº£n pháº©m.`);
    }
    await models[kindValue].deleteOne({ _id: id, companyCode });
    return { deletedId: id };
  },
};
