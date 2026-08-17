import mongoose from "mongoose";
import { runInTransaction } from "../../../config/database";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductTemplateModel } from "../../../model/product-template.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import {
  ProductCatalogBrandModel,
  ProductCatalogCategoryModel,
  UnitOfMeasureModel,
} from "../../../model/product-catalog-resource.model";
import type {
  ProductCatalogType,
  ProductTemplateField,
  ProductTemplateFieldType,
  ProductTrackingMode,
} from "../../../interface/product-catalog.interface";

export class ProductCatalogValidationError extends Error {
  statusCode = 400;
}

const PRODUCT_TYPES: ProductCatalogType[] = ["physical", "service", "bundle"];
const TRACKING_MODES: ProductTrackingMode[] = ["none", "quantity", "unit_barcode", "serial", "lot"];
const FIELD_TYPES: ProductTemplateFieldType[] = ["text", "number", "boolean", "select", "multi-select"];
const PRODUCT_STATUSES = ["draft", "active", "inactive", "archived"] as const;
const VARIANT_STATUSES = ["active", "inactive", "discontinued"] as const;
const DEFAULT_UNIT_CODE = "UOM-CAI";
const FORBIDDEN_CATALOG_FIELDS = [
  "companyCode",
  "branchId",
  "stock",
  "minStockAlert",
  "price",
  "costPrice",
  "inventory",
  "warehouseId",
];

type AttributeInput = { code: string; value: string; unitCode?: string };

export interface ProductCatalogCreateInput {
  productCode?: string;
  name: string;
  productType: ProductCatalogType;
  templateCode?: string;
  categoryCode: string;
  brandCode?: string;
  baseUnitCode?: string;
  shortDescription?: string;
  description?: string;
  attributes?: AttributeInput[];
  searchKeywords?: string[];
  countryOfOrigin?: string;
  manufacturer?: string;
  taxCategory?: string;
  status?: (typeof PRODUCT_STATUSES)[number];
  mediaIds?: string[];
  documentIds?: string[];
  variant: ProductVariantInput;
}

export interface ProductCatalogBulkCreateInput extends Omit<ProductCatalogCreateInput, "variant"> {
  variants: ProductVariantInput[];
}

export interface ProductCatalogUpdateInput {
  name?: string;
  categoryCode?: string;
  brandCode?: string | null;
  baseUnitCode?: string;
  shortDescription?: string;
  description?: string;
  attributes?: AttributeInput[];
  searchKeywords?: string[];
  countryOfOrigin?: string;
  manufacturer?: string;
  taxCategory?: string;
  status?: (typeof PRODUCT_STATUSES)[number];
  mediaIds?: string[];
  documentIds?: string[];
}

export interface ProductVariantInput {
  sku: string;
  barcode?: string;
  optionValues?: Array<{ code: string; value: string }>;
  displayName?: string;
  unitCode: string;
  trackingMode?: ProductTrackingMode;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  warrantyMonths?: number;
  attributes?: AttributeInput[];
  mediaIds?: string[];
  status?: (typeof VARIANT_STATUSES)[number];
}

export interface ProductVariantUpdateInput extends Omit<Partial<ProductVariantInput>, "sku"> {}

export interface ProductVariantBulkUpdateInput {
  status?: (typeof VARIANT_STATUSES)[number];
  trackingMode?: ProductTrackingMode;
}

export interface ProductTemplateInput {
  code?: string;
  name: string;
  productType: ProductCatalogType;
  fields: Array<Partial<ProductTemplateField> & { code: string; label: string; type: ProductTemplateFieldType }>;
  status?: "active" | "inactive";
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeCompanyCode(value: unknown): string {
  const code = String(value || "").trim().toUpperCase();
  if (!code) throw new ProductCatalogValidationError("TÃ i khoáº£n chÆ°a Ä‘Æ°á»£c gáº¯n vá»›i cÃ´ng ty.");
  return code;
}

export function normalizeCode(value: unknown, field: string): string {
  const code = String(value || "").trim().toUpperCase();
  if (!code) throw new ProductCatalogValidationError(`${field} lÃ  báº¯t buá»™c.`);
  if (code.length > 100) throw new ProductCatalogValidationError(`${field} khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 100 kÃ½ tá»±.`);
  return code;
}

export function normalizeName(value: unknown, field = "TÃªn sáº£n pháº©m"): string {
  const name = String(value || "").trim();
  if (!name) throw new ProductCatalogValidationError(`${field} lÃ  báº¯t buá»™c.`);
  if (name.length > 300) throw new ProductCatalogValidationError(`${field} khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 300 kÃ½ tá»±.`);
  return name;
}

export function codeFromName(prefix: string, value: unknown): string {
  const name = normalizeName(value, "TÃªn");
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Ä‘Ä]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "ITEM";
  return `${prefix}-${slug}`.slice(0, 100);
}

export async function resolveNextCatalogCode(model: mongoose.Model<any>, companyCode: string, prefix: string, name: unknown): Promise<string> {
  const base = codeFromName(prefix, name);
  let candidate = base;
  let suffix = 2;
  while (await model.exists({ companyCode, code: candidate })) {
    candidate = `${base.slice(0, 95)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function assertNoForbiddenCatalogFields(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const present = FORBIDDEN_CATALOG_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(value, field));
  if (present.length) {
    throw new ProductCatalogValidationError(`CÃ¡c trÆ°á»ng ${present.join(", ")} chá»‰ Ä‘Æ°á»£c quáº£n lÃ½ á»Ÿ phÃ¢n há»‡ kho/giÃ¡, khÃ´ng ghi trong danh má»¥c sáº£n pháº©m.`);
  }
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ProductCatalogValidationError(`${field} khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ ${maxLength} kÃ½ tá»±.`);
  return text;
}

function stringArray(value: unknown, field: string, maxItems = 100): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError(`${field} pháº£i lÃ  má»™t máº£ng.`);
  if (value.length > maxItems) throw new ProductCatalogValidationError(`${field} vÆ°á»£t quÃ¡ sá»‘ lÆ°á»£ng cho phÃ©p.`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeAttributes(value: unknown): AttributeInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError("attributes pháº£i lÃ  má»™t máº£ng.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new ProductCatalogValidationError(`attributes[${index}] khÃ´ng há»£p lá»‡.`);
    const input = item as Record<string, unknown>;
    const code = normalizeCode(input.code, `MÃ£ thuá»™c tÃ­nh táº¡i vá»‹ trÃ­ ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`Thuá»™c tÃ­nh ${code} bá»‹ láº·p.`);
    seen.add(code);
    const result: AttributeInput = { code, value: String(input.value ?? "").trim() };
    if (!result.value) throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ thuá»™c tÃ­nh ${code} lÃ  báº¯t buá»™c.`);
    const unitCode = input.unitCode ? normalizeCode(input.unitCode, `ÄÆ¡n vá»‹ cá»§a thuá»™c tÃ­nh ${code}`) : undefined;
    if (unitCode) result.unitCode = unitCode;
    return result;
  });
}

function normalizeOptionValues(value: unknown): Array<{ code: string; value: string }> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError("optionValues pháº£i lÃ  má»™t máº£ng.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new ProductCatalogValidationError(`optionValues[${index}] khÃ´ng há»£p lá»‡.`);
    const input = item as Record<string, unknown>;
    const code = normalizeCode(input.code, `MÃ£ lá»±a chá»n táº¡i vá»‹ trÃ­ ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`Lá»±a chá»n ${code} bá»‹ láº·p.`);
    seen.add(code);
    const optionValue = String(input.value ?? "").trim();
    if (!optionValue) throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ lá»±a chá»n ${code} lÃ  báº¯t buá»™c.`);
    return { code, value: optionValue };
  });
}

export function normalizeVariantInput(input: unknown, productType?: ProductCatalogType): ProductVariantInput {
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Sáº£n pháº©m pháº£i cÃ³ Ã­t nháº¥t má»™t SKU/biáº¿n thá»ƒ.");
  assertNoForbiddenCatalogFields(input);
  const value = input as Record<string, unknown>;
  const trackingMode = (value.trackingMode || "none") as ProductTrackingMode;
  if (!TRACKING_MODES.includes(trackingMode)) throw new ProductCatalogValidationError("trackingMode khÃ´ng há»£p lá»‡.");
  if (productType === "service" && trackingMode !== "none") throw new ProductCatalogValidationError("Sáº£n pháº©m dá»‹ch vá»¥ pháº£i cÃ³ trackingMode lÃ  none.");
  const status = (value.status || "active") as (typeof VARIANT_STATUSES)[number];
  assertVariantStatus(status);

  const numeric = (field: string, max?: number) => {
    if (value[field] === undefined || value[field] === null || value[field] === "") return undefined;
    const numberValue = Number(value[field]);
    if (!Number.isFinite(numberValue) || numberValue < 0 || (max !== undefined && numberValue > max)) {
      throw new ProductCatalogValidationError(`${field} pháº£i lÃ  sá»‘ khÃ´ng Ã¢m${max === undefined ? "" : ` vÃ  khÃ´ng vÆ°á»£t quÃ¡ ${max}`}.`);
    }
    return numberValue;
  };

  return {
    sku: normalizeCode(value.sku, "SKU"),
    barcode: optionalText(value.barcode, "Barcode", 100),
    optionValues: normalizeOptionValues(value.optionValues),
    displayName: optionalText(value.displayName, "TÃªn hiá»ƒn thá»‹ SKU", 200),
    unitCode: normalizeCode(value.unitCode, "MÃ£ Ä‘Æ¡n vá»‹ tÃ­nh"),
    trackingMode,
    weightGrams: numeric("weightGrams"),
    lengthMm: numeric("lengthMm"),
    widthMm: numeric("widthMm"),
    heightMm: numeric("heightMm"),
    warrantyMonths: numeric("warrantyMonths", 1_200),
    attributes: normalizeAttributes(value.attributes),
    mediaIds: stringArray(value.mediaIds, "mediaIds"),
    status,
  };
}

export function normalizeProductInput(input: unknown, partial = false): ProductCatalogUpdateInput & Partial<ProductCatalogCreateInput> {
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Dá»¯ liá»‡u sáº£n pháº©m khÃ´ng há»£p lá»‡.");
  assertNoForbiddenCatalogFields(input);
  const value = input as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (!partial || value.name !== undefined) output.name = normalizeName(value.name);
  if (!partial || value.categoryCode !== undefined) output.categoryCode = normalizeCode(value.categoryCode, "MÃ£ danh má»¥c");
  if (value.baseUnitCode !== undefined && value.baseUnitCode !== null && String(value.baseUnitCode).trim()) {
    output.baseUnitCode = normalizeCode(value.baseUnitCode, "MÃ£ Ä‘Æ¡n vá»‹ cÆ¡ sá»Ÿ");
  }
  if (value.productCode !== undefined && value.productCode !== null && String(value.productCode).trim()) {
    output.productCode = normalizeCode(value.productCode, "MÃ£ sáº£n pháº©m");
  }
  if (value.templateCode !== undefined && value.templateCode !== null && String(value.templateCode).trim()) {
    output.templateCode = normalizeCode(value.templateCode, "MÃ£ máº«u sáº£n pháº©m");
  }
  if (!partial || value.productType !== undefined) {
    if (!PRODUCT_TYPES.includes(value.productType as ProductCatalogType)) throw new ProductCatalogValidationError("productType khÃ´ng há»£p lá»‡.");
    output.productType = value.productType;
  }
  for (const field of ["shortDescription", "description", "countryOfOrigin", "manufacturer", "taxCategory"] as const) {
    if (!partial || value[field] !== undefined) output[field] = optionalText(value[field], field, field === "description" ? 20_000 : field === "shortDescription" ? 500 : 200);
  }
  if (!partial || value.brandCode !== undefined) output.brandCode = value.brandCode === null ? null : value.brandCode ? normalizeCode(value.brandCode, "MÃ£ thÆ°Æ¡ng hiá»‡u") : undefined;
  if (!partial || value.attributes !== undefined) output.attributes = normalizeAttributes(value.attributes);
  if (!partial || value.searchKeywords !== undefined) output.searchKeywords = stringArray(value.searchKeywords, "searchKeywords");
  if (!partial || value.mediaIds !== undefined) output.mediaIds = stringArray(value.mediaIds, "mediaIds");
  if (!partial || value.documentIds !== undefined) output.documentIds = stringArray(value.documentIds, "documentIds");
  if (!partial || value.status !== undefined) {
    const nextStatus = value.status === undefined ? "draft" : value.status;
    if (!PRODUCT_STATUSES.includes(nextStatus as (typeof PRODUCT_STATUSES)[number])) throw new ProductCatalogValidationError("Tráº¡ng thÃ¡i sáº£n pháº©m khÃ´ng há»£p lá»‡.");
    output.status = nextStatus;
  }
  return output as ProductCatalogUpdateInput & Partial<ProductCatalogCreateInput>;
}

function assertVariantStatus(status: unknown): asserts status is (typeof VARIANT_STATUSES)[number] {
  if (!VARIANT_STATUSES.includes(status as (typeof VARIANT_STATUSES)[number])) throw new ProductCatalogValidationError("Tráº¡ng thÃ¡i SKU khÃ´ng há»£p lá»‡.");
}

function assertObjectId(id: string, label: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ProductCatalogValidationError(`${label} khÃ´ng há»£p lá»‡.`);
}

function actorId(value: unknown): string {
  const id = String(value || "").trim();
  if (!id) throw new ProductCatalogValidationError("KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c ngÆ°á»i thá»±c hiá»‡n thao tÃ¡c.");
  return id;
}

async function findTemplate(companyCode: string, templateCode: string, session?: mongoose.ClientSession) {
  const query = ProductTemplateModel.findOne({ companyCode, code: templateCode, status: "active" });
  if (session) query.session(session);
  const template = await query.lean();
  if (!template) throw new ProductCatalogValidationError(`KhÃ´ng tÃ¬m tháº¥y máº«u sáº£n pháº©m Ä‘ang hoáº¡t Ä‘á»™ng: ${templateCode}.`);
  return template;
}

async function assertActiveUnit(companyCode: string, unitCode: string, session?: mongoose.ClientSession): Promise<void> {
  const query = UnitOfMeasureModel.findOne({ companyCode, code: unitCode, status: "active" });
  if (session) query.session(session);
  if (!(await query.lean())) throw new ProductCatalogValidationError(`ÄÆ¡n vá»‹ tÃ­nh chÆ°a Ä‘Æ°á»£c khai bÃ¡o hoáº·c Ä‘Ã£ ngá»«ng dÃ¹ng: ${unitCode}.`);
}

async function ensureDefaultUnit(companyCode: string, actor: string, session?: mongoose.ClientSession): Promise<string> {
  const query = UnitOfMeasureModel.findOneAndUpdate(
    { companyCode, code: DEFAULT_UNIT_CODE },
    {
      $set: { status: "active", updatedBy: actor },
      $setOnInsert: {
        companyCode,
        code: DEFAULT_UNIT_CODE,
        name: "CÃ¡i",
        symbol: "cÃ¡i",
        category: "count",
        decimalPlaces: 0,
        createdBy: actor,
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  if (session) query.session(session);
  await query.lean();
  return DEFAULT_UNIT_CODE;
}

async function assertActiveMasterResources(
  companyCode: string,
  input: { categoryCode: string; brandCode?: string; baseUnitCode: string },
  session?: mongoose.ClientSession,
): Promise<void> {
  const categoryQuery = ProductCatalogCategoryModel.findOne({ companyCode, code: input.categoryCode, status: "active" });
  if (session) categoryQuery.session(session);
  if (!(await categoryQuery.lean())) throw new ProductCatalogValidationError(`Danh má»¥c chÆ°a Ä‘Æ°á»£c khai bÃ¡o hoáº·c Ä‘Ã£ ngá»«ng dÃ¹ng: ${input.categoryCode}.`);
  if (input.brandCode) {
    const brandQuery = ProductCatalogBrandModel.findOne({ companyCode, code: input.brandCode, status: "active" });
    if (session) brandQuery.session(session);
    if (!(await brandQuery.lean())) throw new ProductCatalogValidationError(`ThÆ°Æ¡ng hiá»‡u chÆ°a Ä‘Æ°á»£c khai bÃ¡o hoáº·c Ä‘Ã£ ngá»«ng dÃ¹ng: ${input.brandCode}.`);
  }
  await assertActiveUnit(companyCode, input.baseUnitCode, session);
}

function normalizeTemplateFields(fields: ProductTemplateInput["fields"]): ProductTemplateField[] {
  if (!Array.isArray(fields) || fields.length === 0) throw new ProductCatalogValidationError("Máº«u sáº£n pháº©m pháº£i cÃ³ Ã­t nháº¥t má»™t trÆ°á»ng thÃ´ng tin.");
  const seen = new Set<string>();
  return fields.map((field, index) => {
    const code = normalizeCode(field.code, `MÃ£ trÆ°á»ng ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`TrÆ°á»ng ${code} bá»‹ láº·p trong máº«u.`);
    seen.add(code);
    if (!FIELD_TYPES.includes(field.type)) throw new ProductCatalogValidationError(`Kiá»ƒu dá»¯ liá»‡u cá»§a trÆ°á»ng ${code} khÃ´ng há»£p lá»‡.`);
    const options = stringArray(field.options, `options cá»§a ${code}`);
    if ((field.type === "select" || field.type === "multi-select") && options.length === 0) {
      throw new ProductCatalogValidationError(`TrÆ°á»ng ${code} pháº£i cÃ³ options.`);
    }
    return {
      code,
      label: normalizeName(field.label, `NhÃ£n trÆ°á»ng ${code}`),
      type: field.type,
      required: Boolean(field.required),
      options,
      unitCode: field.unitCode ? normalizeCode(field.unitCode, `ÄÆ¡n vá»‹ cá»§a ${code}`) : undefined,
    };
  });
}

export function assertTemplateAttributes(
  template: { fields: ProductTemplateField[] },
  attributes: AttributeInput[] = [],
): void {
  const fields = new Map(template.fields.map((field) => [field.code, field]));
  const values = new Map(attributes.map((attribute) => [attribute.code, attribute.value]));
  for (const field of template.fields) {
    if (field.required && !values.has(field.code)) {
      throw new ProductCatalogValidationError(`Thiáº¿u thuá»™c tÃ­nh báº¯t buá»™c theo máº«u: ${field.label}.`);
    }
  }
  for (const attribute of attributes) {
    const field = fields.get(attribute.code);
    if (!field) throw new ProductCatalogValidationError(`Thuá»™c tÃ­nh ${attribute.code} khÃ´ng thuá»™c máº«u sáº£n pháº©m Ä‘Ã£ chá»n.`);
    if (field.type === "number" && !Number.isFinite(Number(attribute.value))) {
      throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ ${field.label} pháº£i lÃ  sá»‘.`);
    }
    if (field.type === "boolean" && !["true", "false"].includes(attribute.value.toLowerCase())) {
      throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ ${field.label} pháº£i lÃ  true hoáº·c false.`);
    }
    if (field.type === "select" && !field.options.includes(attribute.value)) {
      throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ ${attribute.value} khÃ´ng cÃ³ trong lá»±a chá»n cá»§a ${field.label}.`);
    }
    if (field.type === "multi-select") {
      const invalid = attribute.value.split(",").map((value) => value.trim()).filter(Boolean).some((value) => !field.options.includes(value));
      if (invalid) throw new ProductCatalogValidationError(`GiÃ¡ trá»‹ cá»§a ${field.label} chá»©a lá»±a chá»n khÃ´ng há»£p lá»‡.`);
    }
  }
}

export const ProductCatalogService = {
  async listTemplates(companyCodeValue: unknown, query: Record<string, unknown> = {}) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const filter: Record<string, unknown> = { companyCode };
    const productType = query.productType ? String(query.productType).trim().toLowerCase() : "";
    if (productType && PRODUCT_TYPES.includes(productType as ProductCatalogType)) filter.productType = productType;
    if (query.status === "active" || query.status === "inactive") filter.status = query.status;
    return ProductTemplateModel.find(filter).sort({ name: 1 }).lean();
  },

  async createTemplate(companyCodeValue: unknown, input: ProductTemplateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    if (!PRODUCT_TYPES.includes(input.productType)) throw new ProductCatalogValidationError("productType khÃ´ng há»£p lá»‡.");
    const code = input.code ? normalizeCode(input.code, "MÃ£ máº«u sáº£n pháº©m") : await resolveNextCatalogCode(ProductTemplateModel, companyCode, "TPL", input.name);
    const document = await ProductTemplateModel.create({
      companyCode,
      code,
      name: normalizeName(input.name, "TÃªn máº«u sáº£n pháº©m"),
      productType: input.productType,
      fields: normalizeTemplateFields(input.fields),
      status: input.status || "active",
      createdBy,
      updatedBy: createdBy,
    });
    return document.toObject();
  },

  async updateTemplate(companyCodeValue: unknown, id: string, input: Partial<ProductTemplateInput>, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    assertObjectId(id, "ID máº«u sáº£n pháº©m");
    const current = await ProductTemplateModel.findOne({ _id: id, companyCode });
    if (!current) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y máº«u sáº£n pháº©m."), { statusCode: 404 });
    if (input.code && normalizeCode(input.code, "MÃ£ máº«u sáº£n pháº©m") !== current.code) {
      throw new ProductCatalogValidationError("MÃ£ template Ä‘Ã£ Ä‘Æ°á»£c há»‡ thá»‘ng cáº¥p, khÃ´ng thá»ƒ thay Ä‘á»•i.");
    }
    if (input.productType && input.productType !== current.productType) {
      throw new ProductCatalogValidationError("KhÃ´ng thá»ƒ Ä‘á»•i loáº¡i sáº£n pháº©m cá»§a template Ä‘ang sá»­ dá»¥ng.");
    }
    const status = input.status === undefined ? current.status : input.status;
    if (status !== "active" && status !== "inactive") throw new ProductCatalogValidationError("Tráº¡ng thÃ¡i template khÃ´ng há»£p lá»‡.");
    const document = await ProductTemplateModel.findOneAndUpdate(
      { _id: id, companyCode },
      {
        $set: {
          name: input.name === undefined ? current.name : normalizeName(input.name, "TÃªn máº«u sáº£n pháº©m"),
          fields: input.fields === undefined ? current.fields : normalizeTemplateFields(input.fields as ProductTemplateInput["fields"]),
          status,
          updatedBy,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!document) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y máº«u sáº£n pháº©m."), { statusCode: 404 });
    return document.toObject();
  },

  async list(companyCodeValue: unknown, query: Record<string, unknown> = {}) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = { companyCode };
    for (const field of ["status", "productType", "templateCode", "categoryCode"] as const) {
      if (query[field]) {
        const value = String(query[field]).trim();
        filter[field] = field === "status" || field === "productType" ? value.toLowerCase() : value.toUpperCase();
      }
    }
    if (filter.productType && !PRODUCT_TYPES.includes(filter.productType as ProductCatalogType)) throw new ProductCatalogValidationError("productType khÃ´ng há»£p lá»‡.");
    if (filter.status && !PRODUCT_STATUSES.includes(filter.status as (typeof PRODUCT_STATUSES)[number])) throw new ProductCatalogValidationError("Tráº¡ng thÃ¡i sáº£n pháº©m khÃ´ng há»£p lá»‡.");
    const q = String(query.q || "").trim();
    if (q) {
      const expression = new RegExp(escapeRegex(q), "i");
      const variantProductIds = await ProductVariantModel.find({ companyCode, sku: expression }).select("productId").limit(200).lean();
      filter.$or = [{ productCode: expression }, { name: expression }, { normalizedName: expression }, { searchKeywords: expression }, { _id: { $in: variantProductIds.map((variant: any) => variant.productId) } }];
    }
    const [items, total] = await Promise.all([
      ProductCatalogModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProductCatalogModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async get(companyCodeValue: unknown, id: string) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertObjectId(id, "ID sáº£n pháº©m");
    const product = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!product) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m."), { statusCode: 404 });
    const variants = await ProductVariantModel.find({ companyCode, productId: id }).sort({ sku: 1 }).lean();
    return { ...product, variants };
  },

  async create(companyCodeValue: unknown, input: ProductCatalogCreateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    const normalized = normalizeProductInput(input) as ProductCatalogCreateInput;
    if (!normalized.productType) throw new ProductCatalogValidationError("productType lÃ  báº¯t buá»™c.");
    const productCode = normalized.productCode || await resolveNextCatalogCode(ProductCatalogModel, companyCode, "SP", normalized.name);
    const baseUnitCode = normalized.baseUnitCode || DEFAULT_UNIT_CODE;
    const variant = normalizeVariantInput({ ...input.variant, unitCode: input.variant.unitCode || baseUnitCode }, normalized.productType);
    if (variant.status === "active" && (normalized.status === "inactive" || normalized.status === "archived")) {
      throw new ProductCatalogValidationError("Sáº£n pháº©m inactive/archived khÃ´ng thá»ƒ cÃ³ SKU Ä‘ang hoáº¡t Ä‘á»™ng.");
    }
    let productId = "";
    await runInTransaction(async (session) => {
      await ensureDefaultUnit(companyCode, createdBy, session);
      if (normalized.templateCode) {
        const template = await findTemplate(companyCode, normalized.templateCode, session);
        if (template.productType !== normalized.productType) {
          throw new ProductCatalogValidationError(`Máº«u ${normalized.templateCode} khÃ´ng Ã¡p dá»¥ng cho loáº¡i sáº£n pháº©m ${normalized.productType}.`);
        }
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes?.length) {
        throw new ProductCatalogValidationError("Thuá»™c tÃ­nh tÃ¹y biáº¿n chá»‰ Ä‘Æ°á»£c dÃ¹ng khi sáº£n pháº©m cÃ³ máº«u sáº£n pháº©m.");
      }
      await assertActiveMasterResources(companyCode, { ...normalized, baseUnitCode } as { categoryCode: string; brandCode?: string; baseUnitCode: string }, session);
      await assertActiveUnit(companyCode, variant.unitCode, session);
      const [product] = await ProductCatalogModel.create([{ ...normalized, productCode, baseUnitCode, companyCode, normalizedName: normalized.name!.toLocaleLowerCase("vi-VN"), createdBy, updatedBy: createdBy }], { session });
      productId = String(product._id);
      await ProductVariantModel.create([{ ...variant, companyCode, productId, createdBy, updatedBy: createdBy }], { session });
    });
    return this.get(companyCode, productId);
  },

  async bulkCreateWithVariants(companyCodeValue: unknown, input: ProductCatalogBulkCreateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    const normalized = normalizeProductInput(input) as ProductCatalogCreateInput;
    if (!normalized.productType) throw new ProductCatalogValidationError("productType lÃ  báº¯t buá»™c.");
    const productCode = normalized.productCode || await resolveNextCatalogCode(ProductCatalogModel, companyCode, "SP", normalized.name);
    const baseUnitCode = normalized.baseUnitCode || DEFAULT_UNIT_CODE;

    if (!Array.isArray(input.variants) || input.variants.length === 0 || input.variants.length > 500) {
      throw new ProductCatalogValidationError("Sáº£n pháº©m pháº£i cÃ³ tá»« 1 Ä‘áº¿n 500 biáº¿n thá»ƒ (SKU).");
    }

    const variants = input.variants.map((variant) => normalizeVariantInput({ ...variant, unitCode: variant.unitCode || baseUnitCode }, normalized.productType));
    
    if (variants.some(v => v.status === "active") && (normalized.status === "inactive" || normalized.status === "archived")) {
      throw new ProductCatalogValidationError("Sáº£n pháº©m inactive/archived khÃ´ng thá»ƒ cÃ³ SKU Ä‘ang hoáº¡t Ä‘á»™ng.");
    }

    const skuSet = new Set<string>();
    const barcodeSet = new Set<string>();
    for (const variant of variants) {
      if (skuSet.has(variant.sku)) throw new ProductCatalogValidationError(`SKU bá»‹ láº·p trong danh sÃ¡ch: ${variant.sku}.`);
      skuSet.add(variant.sku);
      if (variant.barcode) {
        if (barcodeSet.has(variant.barcode)) throw new ProductCatalogValidationError(`MÃ£ váº¡ch bá»‹ láº·p trong danh sÃ¡ch: ${variant.barcode}.`);
        barcodeSet.add(variant.barcode);
      }
    }
    
    const existing = await ProductVariantModel.find({ companyCode, $or: [{ sku: { $in: [...skuSet] } }, ...(barcodeSet.size ? [{ barcode: { $in: [...barcodeSet] } }] : [])] }).select("sku barcode").lean();
    if (existing.length) throw new ProductCatalogValidationError(`SKU hoáº·c mÃ£ váº¡ch Ä‘Ã£ tá»“n táº¡i: ${existing.map((item: any) => item.sku || item.barcode).join(", ")}.`);

    let productId = "";
    await runInTransaction(async (session) => {
      await ensureDefaultUnit(companyCode, createdBy, session);
      if (normalized.templateCode) {
        const template = await findTemplate(companyCode, normalized.templateCode, session);
        if (template.productType !== normalized.productType) {
          throw new ProductCatalogValidationError(`Máº«u ${normalized.templateCode} khÃ´ng Ã¡p dá»¥ng cho loáº¡i sáº£n pháº©m ${normalized.productType}.`);
        }
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes?.length) {
        throw new ProductCatalogValidationError("Thuá»™c tÃ­nh tÃ¹y biáº¿n chá»‰ Ä‘Æ°á»£c dÃ¹ng khi sáº£n pháº©m cÃ³ máº«u sáº£n pháº©m.");
      }
      await assertActiveMasterResources(companyCode, { ...normalized, baseUnitCode } as { categoryCode: string; brandCode?: string; baseUnitCode: string }, session);
      
      for (const variant of variants) await assertActiveUnit(companyCode, variant.unitCode, session);
      
      const [product] = await ProductCatalogModel.create([{ ...normalized, productCode, baseUnitCode, companyCode, normalizedName: normalized.name!.toLocaleLowerCase("vi-VN"), createdBy, updatedBy: createdBy }], { session });
      productId = String(product._id);
      
      await ProductVariantModel.create(variants.map(variant => ({ ...variant, companyCode, productId, createdBy, updatedBy: createdBy })), { session });
    });
    return this.get(companyCode, productId);
  },

  async update(companyCodeValue: unknown, id: string, input: ProductCatalogUpdateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    assertObjectId(id, "ID sáº£n pháº©m");
    assertNoForbiddenCatalogFields(input);
    const value = input as Record<string, unknown>;
    for (const immutableField of ["productCode", "productType", "templateCode"]) {
      if (Object.prototype.hasOwnProperty.call(value, immutableField)) throw new ProductCatalogValidationError(`${immutableField} khÃ´ng thá»ƒ thay Ä‘á»•i sau khi táº¡o sáº£n pháº©m.`);
    }
    const current = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m."), { statusCode: 404 });
    const normalized = normalizeProductInput(input, true) as ProductCatalogUpdateInput;
    if (normalized.attributes !== undefined) {
      if (current.templateCode) {
        const template = await findTemplate(companyCode, current.templateCode);
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes.length) {
        throw new ProductCatalogValidationError("Thuá»™c tÃ­nh tÃ¹y biáº¿n chá»‰ Ä‘Æ°á»£c dÃ¹ng khi sáº£n pháº©m cÃ³ máº«u sáº£n pháº©m.");
      }
    }
    if ((normalized.status === "inactive" || normalized.status === "archived") && normalized.status !== current.status) {
      const activeVariantCount = await ProductVariantModel.countDocuments({ companyCode, productId: id, status: "active" });
      if (activeVariantCount > 0) throw new ProductCatalogValidationError("HÃ£y ngá»«ng bÃ¡n cÃ¡c SKU Ä‘ang hoáº¡t Ä‘á»™ng trÆ°á»›c khi ngá»«ng sáº£n pháº©m.");
    }
    await assertActiveMasterResources(companyCode, {
      categoryCode: normalized.categoryCode || current.categoryCode,
      brandCode: normalized.brandCode === null ? undefined : normalized.brandCode || current.brandCode,
      baseUnitCode: normalized.baseUnitCode || current.baseUnitCode,
    });
    const update: Record<string, unknown> = { ...normalized, updatedBy };
    const clearBrand = normalized.brandCode === null;
    if (clearBrand) delete update.brandCode;
    if (normalized.name) update.normalizedName = normalized.name.toLocaleLowerCase("vi-VN");
    await ProductCatalogModel.findOneAndUpdate({ _id: id, companyCode }, { $set: update, ...(clearBrand ? { $unset: { brandCode: 1 } } : {}) }, { returnDocument: "after", runValidators: true }).lean();
    return this.get(companyCode, id);
  },

  async createVariant(companyCodeValue: unknown, productId: string, input: ProductVariantInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    assertObjectId(productId, "ID sáº£n pháº©m");
    const product = await ProductCatalogModel.findOne({ _id: productId, companyCode }).select("productType status").lean();
    if (!product) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m."), { statusCode: 404 });
    if (product.status === "archived") throw new ProductCatalogValidationError("KhÃ´ng thá»ƒ thÃªm SKU cho sáº£n pháº©m Ä‘Ã£ lÆ°u trá»¯.");
    const variant = normalizeVariantInput(input, product.productType);
    if (variant.status === "active" && product.status !== "active") throw new ProductCatalogValidationError("Chá»‰ sáº£n pháº©m Ä‘ang hoáº¡t Ä‘á»™ng má»›i Ä‘Æ°á»£c má»Ÿ bÃ¡n SKU.");
    await assertActiveUnit(companyCode, variant.unitCode);
    const document = await ProductVariantModel.create({ ...variant, companyCode, productId, createdBy, updatedBy: createdBy });
    return document.toObject();
  },

  async createVariants(companyCodeValue: unknown, productId: string, inputs: ProductVariantInput[], actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    assertObjectId(productId, "ID sáº£n pháº©m");
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 500) throw new ProductCatalogValidationError("Danh sÃ¡ch SKU pháº£i cÃ³ tá»« 1 Ä‘áº¿n 500 dÃ²ng.");
    const product = await ProductCatalogModel.findOne({ _id: productId, companyCode }).select("productType status").lean();
    if (!product) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m."), { statusCode: 404 });
    if (product.status === "archived") throw new ProductCatalogValidationError("KhÃ´ng thá»ƒ thÃªm SKU cho sáº£n pháº©m Ä‘Ã£ lÆ°u trá»¯.");
    const variants = inputs.map((input) => normalizeVariantInput(input, product.productType));
    if (variants.some((variant) => variant.status === "active") && product.status !== "active") throw new ProductCatalogValidationError("Chá»‰ sáº£n pháº©m Ä‘ang hoáº¡t Ä‘á»™ng má»›i Ä‘Æ°á»£c má»Ÿ bÃ¡n SKU.");
    const skuSet = new Set<string>();
    const barcodeSet = new Set<string>();
    for (const variant of variants) {
      if (skuSet.has(variant.sku)) throw new ProductCatalogValidationError(`SKU bá»‹ láº·p trong danh sÃ¡ch: ${variant.sku}.`);
      skuSet.add(variant.sku);
      if (variant.barcode) {
        if (barcodeSet.has(variant.barcode)) throw new ProductCatalogValidationError(`MÃ£ váº¡ch bá»‹ láº·p trong danh sÃ¡ch: ${variant.barcode}.`);
        barcodeSet.add(variant.barcode);
      }
    }
    const existing = await ProductVariantModel.find({ companyCode, $or: [{ sku: { $in: [...skuSet] } }, ...(barcodeSet.size ? [{ barcode: { $in: [...barcodeSet] } }] : [])] }).select("sku barcode").lean();
    if (existing.length) throw new ProductCatalogValidationError(`SKU hoáº·c mÃ£ váº¡ch Ä‘Ã£ tá»“n táº¡i: ${existing.map((item: any) => item.sku || item.barcode).join(", ")}.`);
    let documents: any[] = [];
    await runInTransaction(async (session) => {
      for (const variant of variants) await assertActiveUnit(companyCode, variant.unitCode, session);
      documents = await ProductVariantModel.create(variants.map((variant) => ({ ...variant, companyCode, productId, createdBy, updatedBy: createdBy })), { session });
    });
    return documents.map((document) => document.toObject());
  },

  async updateVariant(companyCodeValue: unknown, id: string, input: ProductVariantUpdateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    assertObjectId(id, "ID SKU");
    assertNoForbiddenCatalogFields(input);
    const value = input as Record<string, unknown>;
    for (const immutableField of ["sku", "productId", "companyCode"]) {
      if (Object.prototype.hasOwnProperty.call(value, immutableField)) throw new ProductCatalogValidationError(`${immutableField} khÃ´ng thá»ƒ thay Ä‘á»•i sau khi táº¡o SKU.`);
    }
    const current = await ProductVariantModel.findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y SKU."), { statusCode: 404 });
    const product = await ProductCatalogModel.findOne({ _id: current.productId, companyCode }).select("productType status").lean();
    if (!product) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m cá»§a SKU."), { statusCode: 404 });
    const normalized = normalizeVariantInput({
      sku: current.sku,
      barcode: current.barcode,
      optionValues: current.optionValues,
      displayName: current.displayName,
      unitCode: current.unitCode,
      trackingMode: current.trackingMode,
      weightGrams: current.weightGrams,
      lengthMm: current.lengthMm,
      widthMm: current.widthMm,
      heightMm: current.heightMm,
      warrantyMonths: current.warrantyMonths,
      attributes: current.attributes,
      mediaIds: current.mediaIds,
      status: current.status,
      ...input,
    }, product.productType);
    if (normalized.status === "active" && product.status !== "active") throw new ProductCatalogValidationError("Chá»‰ sáº£n pháº©m Ä‘ang hoáº¡t Ä‘á»™ng má»›i Ä‘Æ°á»£c má»Ÿ bÃ¡n SKU.");
    await assertActiveUnit(companyCode, normalized.unitCode);
    const update = { ...normalized, sku: current.sku, productId: current.productId, companyCode, updatedBy };
    const document = await ProductVariantModel.findOneAndUpdate({ _id: id, companyCode }, { $set: update }, { returnDocument: "after", runValidators: true }).lean();
    return document;
  },

  async updateVariants(companyCodeValue: unknown, ids: string[], input: ProductVariantBulkUpdateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length > 500) throw new ProductCatalogValidationError("Danh sÃ¡ch SKU pháº£i cÃ³ tá»« 1 Ä‘áº¿n 500 dÃ²ng.");
    uniqueIds.forEach((id) => assertObjectId(id, "ID SKU"));
    const updates: ProductVariantBulkUpdateInput = {};
    if (input?.status !== undefined) {
      assertVariantStatus(input.status);
      updates.status = input.status;
    }
    if (input?.trackingMode !== undefined) {
      if (!TRACKING_MODES.includes(input.trackingMode)) throw new ProductCatalogValidationError("CÃ¡ch theo dÃµi kho khÃ´ng há»£p lá»‡.");
      updates.trackingMode = input.trackingMode;
    }
    if (!Object.keys(updates).length) throw new ProductCatalogValidationError("ChÆ°a chá»n ná»™i dung cáº§n cáº­p nháº­t.");
    const variants = await ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).lean();
    if (variants.length !== uniqueIds.length) throw new ProductCatalogValidationError("Má»™t hoáº·c nhiá»u SKU khÃ´ng thuá»™c cÃ´ng ty nÃ y.");
    const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
    const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("productType status").lean();
    const productById = new Map(products.map((product: any) => [String(product._id), product]));
    if (updates.status === "active" && variants.some((variant: any) => productById.get(String(variant.productId))?.status !== "active")) throw new ProductCatalogValidationError("Chá»‰ sáº£n pháº©m Ä‘ang hoáº¡t Ä‘á»™ng má»›i Ä‘Æ°á»£c má»Ÿ bÃ¡n SKU.");
    if (updates.trackingMode === "none" && variants.some((variant: any) => productById.get(String(variant.productId))?.productType !== "service")) throw new ProductCatalogValidationError("Sáº£n pháº©m hÃ ng hÃ³a pháº£i theo dÃµi sá»‘ lÆ°á»£ng, lÃ´ hoáº·c sá»‘ sÃª-ri.");
    await ProductVariantModel.updateMany({ _id: { $in: uniqueIds }, companyCode }, { $set: { ...updates, updatedBy } });
    return ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).sort({ sku: 1 }).lean();
  },

  async deleteVariants(companyCodeValue: unknown, ids: string[]) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length > 500) throw new ProductCatalogValidationError("Danh sÃ¡ch SKU pháº£i cÃ³ tá»« 1 Ä‘áº¿n 500 dÃ²ng.");
    uniqueIds.forEach((id) => assertObjectId(id, "ID SKU"));
    const variants = await ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).select("productId sku").lean();
    if (variants.length !== uniqueIds.length) throw new ProductCatalogValidationError("Má»™t hoáº·c nhiá»u SKU khÃ´ng thuá»™c cÃ´ng ty nÃ y.");
    const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
    const counts = await ProductVariantModel.aggregate([{ $match: { companyCode, productId: { $in: productIds } } }, { $group: { _id: "$productId", count: { $sum: 1 } } }]);
    const countByProduct = new Map(counts.map((item: any) => [String(item._id), Number(item.count)]));
    for (const productId of productIds) {
      if ((countByProduct.get(productId) || 0) <= variants.filter((variant: any) => String(variant.productId) === productId).length) throw new ProductCatalogValidationError("Má»—i sáº£n pháº©m pháº£i giá»¯ láº¡i Ã­t nháº¥t má»™t SKU.");
    }
    const [balance, ledger, receipt] = await Promise.all([
      InventoryBalanceModel.exists({ companyCode, variantId: { $in: uniqueIds } }),
      InventoryLedgerEntryModel.exists({ companyCode, variantId: { $in: uniqueIds } }),
      GoodsReceiptModel.exists({ companyCode, "items.variantId": { $in: uniqueIds } }),
    ]);
    if (balance || ledger || receipt) throw new ProductCatalogValidationError("SKU Ä‘Ã£ cÃ³ tá»“n kho hoáº·c lá»‹ch sá»­ giao dá»‹ch vÃ  khÃ´ng thá»ƒ xÃ³a. HÃ£y chuyá»ƒn sang tráº¡ng thÃ¡i Ngá»«ng dÃ¹ng.");
    await ProductVariantModel.deleteMany({ _id: { $in: uniqueIds }, companyCode });
    return { deletedIds: uniqueIds };
  },

  async deleteProduct(companyCodeValue: unknown, id: string, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    assertObjectId(id, "ID sáº£n pháº©m");
    
    const product = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!product) throw Object.assign(new Error("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m."), { statusCode: 404 });

    const variants = await ProductVariantModel.find({ productId: id, companyCode }).select("_id").lean();
    const variantIds = variants.map(v => String(v._id));

    if (variantIds.length > 0) {
      const [balance, ledger, receipt] = await Promise.all([
        InventoryBalanceModel.exists({ companyCode, variantId: { $in: variantIds } }),
        InventoryLedgerEntryModel.exists({ companyCode, variantId: { $in: variantIds } }),
        GoodsReceiptModel.exists({ companyCode, "items.variantId": { $in: variantIds } }),
      ]);
      if (balance || ledger || receipt) throw new ProductCatalogValidationError("Sáº£n pháº©m Ä‘Ã£ cÃ³ tá»“n kho hoáº·c lá»‹ch sá»­ giao dá»‹ch vÃ  khÃ´ng thá»ƒ xÃ³a. HÃ£y chuyá»ƒn sang tráº¡ng thÃ¡i Ngá»«ng dÃ¹ng.");
    }

    await runInTransaction(async (session) => {
      if (variantIds.length > 0) {
        await ProductVariantModel.deleteMany({ productId: id, companyCode }, { session });
      }
      await ProductCatalogModel.deleteOne({ _id: id, companyCode }, { session });
    });

    return { deletedId: id };
  },
};
