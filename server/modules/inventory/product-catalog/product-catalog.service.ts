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
const TRACKING_MODES: ProductTrackingMode[] = ["none", "quantity", "lot", "serial"];
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
  if (!code) throw new ProductCatalogValidationError("Tài khoản chưa được gắn với công ty.");
  return code;
}

export function normalizeCode(value: unknown, field: string): string {
  const code = String(value || "").trim().toUpperCase();
  if (!code) throw new ProductCatalogValidationError(`${field} là bắt buộc.`);
  if (code.length > 100) throw new ProductCatalogValidationError(`${field} không được vượt quá 100 ký tự.`);
  return code;
}

export function normalizeName(value: unknown, field = "Tên sản phẩm"): string {
  const name = String(value || "").trim();
  if (!name) throw new ProductCatalogValidationError(`${field} là bắt buộc.`);
  if (name.length > 300) throw new ProductCatalogValidationError(`${field} không được vượt quá 300 ký tự.`);
  return name;
}

export function codeFromName(prefix: string, value: unknown): string {
  const name = normalizeName(value, "Tên");
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
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
    throw new ProductCatalogValidationError(`Các trường ${present.join(", ")} chỉ được quản lý ở phân hệ kho/giá, không ghi trong danh mục sản phẩm.`);
  }
}

function optionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (text.length > maxLength) throw new ProductCatalogValidationError(`${field} không được vượt quá ${maxLength} ký tự.`);
  return text;
}

function stringArray(value: unknown, field: string, maxItems = 100): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError(`${field} phải là một mảng.`);
  if (value.length > maxItems) throw new ProductCatalogValidationError(`${field} vượt quá số lượng cho phép.`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeAttributes(value: unknown): AttributeInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError("attributes phải là một mảng.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new ProductCatalogValidationError(`attributes[${index}] không hợp lệ.`);
    const input = item as Record<string, unknown>;
    const code = normalizeCode(input.code, `Mã thuộc tính tại vị trí ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`Thuộc tính ${code} bị lặp.`);
    seen.add(code);
    const result: AttributeInput = { code, value: String(input.value ?? "").trim() };
    if (!result.value) throw new ProductCatalogValidationError(`Giá trị thuộc tính ${code} là bắt buộc.`);
    const unitCode = input.unitCode ? normalizeCode(input.unitCode, `Đơn vị của thuộc tính ${code}`) : undefined;
    if (unitCode) result.unitCode = unitCode;
    return result;
  });
}

function normalizeOptionValues(value: unknown): Array<{ code: string; value: string }> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProductCatalogValidationError("optionValues phải là một mảng.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new ProductCatalogValidationError(`optionValues[${index}] không hợp lệ.`);
    const input = item as Record<string, unknown>;
    const code = normalizeCode(input.code, `Mã lựa chọn tại vị trí ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`Lựa chọn ${code} bị lặp.`);
    seen.add(code);
    const optionValue = String(input.value ?? "").trim();
    if (!optionValue) throw new ProductCatalogValidationError(`Giá trị lựa chọn ${code} là bắt buộc.`);
    return { code, value: optionValue };
  });
}

export function normalizeVariantInput(input: unknown, productType?: ProductCatalogType): ProductVariantInput {
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Sản phẩm phải có ít nhất một SKU/biến thể.");
  assertNoForbiddenCatalogFields(input);
  const value = input as Record<string, unknown>;
  const trackingMode = (value.trackingMode || (productType === "service" ? "none" : "quantity")) as ProductTrackingMode;
  if (!TRACKING_MODES.includes(trackingMode)) throw new ProductCatalogValidationError("trackingMode không hợp lệ.");
  if (productType === "service" && trackingMode !== "none") throw new ProductCatalogValidationError("Sản phẩm dịch vụ phải có trackingMode là none.");
  if (productType !== "service" && trackingMode === "none") throw new ProductCatalogValidationError("Sản phẩm vật lý/gói phải theo dõi số lượng, lô hoặc serial.");
  const status = (value.status || "active") as (typeof VARIANT_STATUSES)[number];
  assertVariantStatus(status);

  const numeric = (field: string, max?: number) => {
    if (value[field] === undefined || value[field] === null || value[field] === "") return undefined;
    const numberValue = Number(value[field]);
    if (!Number.isFinite(numberValue) || numberValue < 0 || (max !== undefined && numberValue > max)) {
      throw new ProductCatalogValidationError(`${field} phải là số không âm${max === undefined ? "" : ` và không vượt quá ${max}`}.`);
    }
    return numberValue;
  };

  return {
    sku: normalizeCode(value.sku, "SKU"),
    barcode: optionalText(value.barcode, "Barcode", 100),
    optionValues: normalizeOptionValues(value.optionValues),
    displayName: optionalText(value.displayName, "Tên hiển thị SKU", 200),
    unitCode: normalizeCode(value.unitCode, "Mã đơn vị tính"),
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
  if (!input || typeof input !== "object") throw new ProductCatalogValidationError("Dữ liệu sản phẩm không hợp lệ.");
  assertNoForbiddenCatalogFields(input);
  const value = input as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (!partial || value.name !== undefined) output.name = normalizeName(value.name);
  if (!partial || value.categoryCode !== undefined) output.categoryCode = normalizeCode(value.categoryCode, "Mã danh mục");
  if (value.baseUnitCode !== undefined && value.baseUnitCode !== null && String(value.baseUnitCode).trim()) {
    output.baseUnitCode = normalizeCode(value.baseUnitCode, "Mã đơn vị cơ sở");
  }
  if (value.productCode !== undefined && value.productCode !== null && String(value.productCode).trim()) {
    output.productCode = normalizeCode(value.productCode, "Mã sản phẩm");
  }
  if (value.templateCode !== undefined && value.templateCode !== null && String(value.templateCode).trim()) {
    output.templateCode = normalizeCode(value.templateCode, "Mã mẫu sản phẩm");
  }
  if (!partial || value.productType !== undefined) {
    if (!PRODUCT_TYPES.includes(value.productType as ProductCatalogType)) throw new ProductCatalogValidationError("productType không hợp lệ.");
    output.productType = value.productType;
  }
  for (const field of ["shortDescription", "description", "countryOfOrigin", "manufacturer", "taxCategory"] as const) {
    if (!partial || value[field] !== undefined) output[field] = optionalText(value[field], field, field === "description" ? 20_000 : field === "shortDescription" ? 500 : 200);
  }
  if (!partial || value.brandCode !== undefined) output.brandCode = value.brandCode === null ? null : value.brandCode ? normalizeCode(value.brandCode, "Mã thương hiệu") : undefined;
  if (!partial || value.attributes !== undefined) output.attributes = normalizeAttributes(value.attributes);
  if (!partial || value.searchKeywords !== undefined) output.searchKeywords = stringArray(value.searchKeywords, "searchKeywords");
  if (!partial || value.mediaIds !== undefined) output.mediaIds = stringArray(value.mediaIds, "mediaIds");
  if (!partial || value.documentIds !== undefined) output.documentIds = stringArray(value.documentIds, "documentIds");
  if (!partial || value.status !== undefined) {
    const nextStatus = value.status === undefined ? "draft" : value.status;
    if (!PRODUCT_STATUSES.includes(nextStatus as (typeof PRODUCT_STATUSES)[number])) throw new ProductCatalogValidationError("Trạng thái sản phẩm không hợp lệ.");
    output.status = nextStatus;
  }
  return output as ProductCatalogUpdateInput & Partial<ProductCatalogCreateInput>;
}

function assertVariantStatus(status: unknown): asserts status is (typeof VARIANT_STATUSES)[number] {
  if (!VARIANT_STATUSES.includes(status as (typeof VARIANT_STATUSES)[number])) throw new ProductCatalogValidationError("Trạng thái SKU không hợp lệ.");
}

function assertObjectId(id: string, label: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ProductCatalogValidationError(`${label} không hợp lệ.`);
}

function actorId(value: unknown): string {
  const id = String(value || "").trim();
  if (!id) throw new ProductCatalogValidationError("Không xác định được người thực hiện thao tác.");
  return id;
}

async function findTemplate(companyCode: string, templateCode: string, session?: mongoose.ClientSession) {
  const query = ProductTemplateModel.findOne({ companyCode, code: templateCode, status: "active" });
  if (session) query.session(session);
  const template = await query.lean();
  if (!template) throw new ProductCatalogValidationError(`Không tìm thấy mẫu sản phẩm đang hoạt động: ${templateCode}.`);
  return template;
}

async function assertActiveUnit(companyCode: string, unitCode: string, session?: mongoose.ClientSession): Promise<void> {
  const query = UnitOfMeasureModel.findOne({ companyCode, code: unitCode, status: "active" });
  if (session) query.session(session);
  if (!(await query.lean())) throw new ProductCatalogValidationError(`Đơn vị tính chưa được khai báo hoặc đã ngừng dùng: ${unitCode}.`);
}

async function ensureDefaultUnit(companyCode: string, actor: string, session?: mongoose.ClientSession): Promise<string> {
  const query = UnitOfMeasureModel.findOneAndUpdate(
    { companyCode, code: DEFAULT_UNIT_CODE },
    {
      $set: { status: "active", updatedBy: actor },
      $setOnInsert: {
        companyCode,
        code: DEFAULT_UNIT_CODE,
        name: "Cái",
        symbol: "cái",
        category: "count",
        decimalPlaces: 0,
        createdBy: actor,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
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
  if (!(await categoryQuery.lean())) throw new ProductCatalogValidationError(`Danh mục chưa được khai báo hoặc đã ngừng dùng: ${input.categoryCode}.`);
  if (input.brandCode) {
    const brandQuery = ProductCatalogBrandModel.findOne({ companyCode, code: input.brandCode, status: "active" });
    if (session) brandQuery.session(session);
    if (!(await brandQuery.lean())) throw new ProductCatalogValidationError(`Thương hiệu chưa được khai báo hoặc đã ngừng dùng: ${input.brandCode}.`);
  }
  await assertActiveUnit(companyCode, input.baseUnitCode, session);
}

function normalizeTemplateFields(fields: ProductTemplateInput["fields"]): ProductTemplateField[] {
  if (!Array.isArray(fields) || fields.length === 0) throw new ProductCatalogValidationError("Mẫu sản phẩm phải có ít nhất một trường thông tin.");
  const seen = new Set<string>();
  return fields.map((field, index) => {
    const code = normalizeCode(field.code, `Mã trường ${index + 1}`);
    if (seen.has(code)) throw new ProductCatalogValidationError(`Trường ${code} bị lặp trong mẫu.`);
    seen.add(code);
    if (!FIELD_TYPES.includes(field.type)) throw new ProductCatalogValidationError(`Kiểu dữ liệu của trường ${code} không hợp lệ.`);
    const options = stringArray(field.options, `options của ${code}`);
    if ((field.type === "select" || field.type === "multi-select") && options.length === 0) {
      throw new ProductCatalogValidationError(`Trường ${code} phải có options.`);
    }
    return {
      code,
      label: normalizeName(field.label, `Nhãn trường ${code}`),
      type: field.type,
      required: Boolean(field.required),
      options,
      unitCode: field.unitCode ? normalizeCode(field.unitCode, `Đơn vị của ${code}`) : undefined,
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
      throw new ProductCatalogValidationError(`Thiếu thuộc tính bắt buộc theo mẫu: ${field.label}.`);
    }
  }
  for (const attribute of attributes) {
    const field = fields.get(attribute.code);
    if (!field) throw new ProductCatalogValidationError(`Thuộc tính ${attribute.code} không thuộc mẫu sản phẩm đã chọn.`);
    if (field.type === "number" && !Number.isFinite(Number(attribute.value))) {
      throw new ProductCatalogValidationError(`Giá trị ${field.label} phải là số.`);
    }
    if (field.type === "boolean" && !["true", "false"].includes(attribute.value.toLowerCase())) {
      throw new ProductCatalogValidationError(`Giá trị ${field.label} phải là true hoặc false.`);
    }
    if (field.type === "select" && !field.options.includes(attribute.value)) {
      throw new ProductCatalogValidationError(`Giá trị ${attribute.value} không có trong lựa chọn của ${field.label}.`);
    }
    if (field.type === "multi-select") {
      const invalid = attribute.value.split(",").map((value) => value.trim()).filter(Boolean).some((value) => !field.options.includes(value));
      if (invalid) throw new ProductCatalogValidationError(`Giá trị của ${field.label} chứa lựa chọn không hợp lệ.`);
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
    if (!PRODUCT_TYPES.includes(input.productType)) throw new ProductCatalogValidationError("productType không hợp lệ.");
    const code = input.code ? normalizeCode(input.code, "Mã mẫu sản phẩm") : await resolveNextCatalogCode(ProductTemplateModel, companyCode, "TPL", input.name);
    const document = await ProductTemplateModel.create({
      companyCode,
      code,
      name: normalizeName(input.name, "Tên mẫu sản phẩm"),
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
    assertObjectId(id, "ID mẫu sản phẩm");
    const current = await ProductTemplateModel.findOne({ _id: id, companyCode });
    if (!current) throw Object.assign(new Error("Không tìm thấy mẫu sản phẩm."), { statusCode: 404 });
    if (input.code && normalizeCode(input.code, "Mã mẫu sản phẩm") !== current.code) {
      throw new ProductCatalogValidationError("Mã template đã được hệ thống cấp, không thể thay đổi.");
    }
    if (input.productType && input.productType !== current.productType) {
      throw new ProductCatalogValidationError("Không thể đổi loại sản phẩm của template đang sử dụng.");
    }
    const status = input.status === undefined ? current.status : input.status;
    if (status !== "active" && status !== "inactive") throw new ProductCatalogValidationError("Trạng thái template không hợp lệ.");
    const document = await ProductTemplateModel.findOneAndUpdate(
      { _id: id, companyCode },
      {
        $set: {
          name: input.name === undefined ? current.name : normalizeName(input.name, "Tên mẫu sản phẩm"),
          fields: input.fields === undefined ? current.fields : normalizeTemplateFields(input.fields as ProductTemplateInput["fields"]),
          status,
          updatedBy,
        },
      },
      { new: true, runValidators: true },
    );
    if (!document) throw Object.assign(new Error("Không tìm thấy mẫu sản phẩm."), { statusCode: 404 });
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
    if (filter.productType && !PRODUCT_TYPES.includes(filter.productType as ProductCatalogType)) throw new ProductCatalogValidationError("productType không hợp lệ.");
    if (filter.status && !PRODUCT_STATUSES.includes(filter.status as (typeof PRODUCT_STATUSES)[number])) throw new ProductCatalogValidationError("Trạng thái sản phẩm không hợp lệ.");
    const q = String(query.q || "").trim();
    if (q) {
      const expression = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ productCode: expression }, { name: expression }, { normalizedName: expression }, { searchKeywords: expression }];
    }
    const [items, total] = await Promise.all([
      ProductCatalogModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProductCatalogModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async get(companyCodeValue: unknown, id: string) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    assertObjectId(id, "ID sản phẩm");
    const product = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });
    const variants = await ProductVariantModel.find({ companyCode, productId: id }).sort({ sku: 1 }).lean();
    return { ...product, variants };
  },

  async create(companyCodeValue: unknown, input: ProductCatalogCreateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    const normalized = normalizeProductInput(input) as ProductCatalogCreateInput;
    if (!normalized.productType) throw new ProductCatalogValidationError("productType là bắt buộc.");
    const productCode = normalized.productCode || await resolveNextCatalogCode(ProductCatalogModel, companyCode, "SP", normalized.name);
    const baseUnitCode = normalized.baseUnitCode || DEFAULT_UNIT_CODE;
    const variant = normalizeVariantInput({ ...input.variant, unitCode: input.variant.unitCode || baseUnitCode }, normalized.productType);
    if (variant.status === "active" && (normalized.status === "inactive" || normalized.status === "archived")) {
      throw new ProductCatalogValidationError("Sản phẩm inactive/archived không thể có SKU đang hoạt động.");
    }
    let productId = "";
    await runInTransaction(async (session) => {
      await ensureDefaultUnit(companyCode, createdBy, session);
      if (normalized.templateCode) {
        const template = await findTemplate(companyCode, normalized.templateCode, session);
        if (template.productType !== normalized.productType) {
          throw new ProductCatalogValidationError(`Mẫu ${normalized.templateCode} không áp dụng cho loại sản phẩm ${normalized.productType}.`);
        }
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes?.length) {
        throw new ProductCatalogValidationError("Thuộc tính tùy biến chỉ được dùng khi sản phẩm có mẫu sản phẩm.");
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
    if (!normalized.productType) throw new ProductCatalogValidationError("productType là bắt buộc.");
    const productCode = normalized.productCode || await resolveNextCatalogCode(ProductCatalogModel, companyCode, "SP", normalized.name);
    const baseUnitCode = normalized.baseUnitCode || DEFAULT_UNIT_CODE;

    if (!Array.isArray(input.variants) || input.variants.length === 0 || input.variants.length > 500) {
      throw new ProductCatalogValidationError("Sản phẩm phải có từ 1 đến 500 biến thể (SKU).");
    }

    const variants = input.variants.map((variant) => normalizeVariantInput({ ...variant, unitCode: variant.unitCode || baseUnitCode }, normalized.productType));
    
    if (variants.some(v => v.status === "active") && (normalized.status === "inactive" || normalized.status === "archived")) {
      throw new ProductCatalogValidationError("Sản phẩm inactive/archived không thể có SKU đang hoạt động.");
    }

    const skuSet = new Set<string>();
    const barcodeSet = new Set<string>();
    for (const variant of variants) {
      if (skuSet.has(variant.sku)) throw new ProductCatalogValidationError(`SKU bị lặp trong danh sách: ${variant.sku}.`);
      skuSet.add(variant.sku);
      if (variant.barcode) {
        if (barcodeSet.has(variant.barcode)) throw new ProductCatalogValidationError(`Mã vạch bị lặp trong danh sách: ${variant.barcode}.`);
        barcodeSet.add(variant.barcode);
      }
    }
    
    const existing = await ProductVariantModel.find({ companyCode, $or: [{ sku: { $in: [...skuSet] } }, ...(barcodeSet.size ? [{ barcode: { $in: [...barcodeSet] } }] : [])] }).select("sku barcode").lean();
    if (existing.length) throw new ProductCatalogValidationError(`SKU hoặc mã vạch đã tồn tại: ${existing.map((item: any) => item.sku || item.barcode).join(", ")}.`);

    let productId = "";
    await runInTransaction(async (session) => {
      await ensureDefaultUnit(companyCode, createdBy, session);
      if (normalized.templateCode) {
        const template = await findTemplate(companyCode, normalized.templateCode, session);
        if (template.productType !== normalized.productType) {
          throw new ProductCatalogValidationError(`Mẫu ${normalized.templateCode} không áp dụng cho loại sản phẩm ${normalized.productType}.`);
        }
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes?.length) {
        throw new ProductCatalogValidationError("Thuộc tính tùy biến chỉ được dùng khi sản phẩm có mẫu sản phẩm.");
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
    assertObjectId(id, "ID sản phẩm");
    assertNoForbiddenCatalogFields(input);
    const value = input as Record<string, unknown>;
    for (const immutableField of ["productCode", "productType", "templateCode"]) {
      if (Object.prototype.hasOwnProperty.call(value, immutableField)) throw new ProductCatalogValidationError(`${immutableField} không thể thay đổi sau khi tạo sản phẩm.`);
    }
    const current = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });
    const normalized = normalizeProductInput(input, true) as ProductCatalogUpdateInput;
    if (normalized.attributes !== undefined) {
      if (current.templateCode) {
        const template = await findTemplate(companyCode, current.templateCode);
        assertTemplateAttributes(template, normalized.attributes);
      } else if (normalized.attributes.length) {
        throw new ProductCatalogValidationError("Thuộc tính tùy biến chỉ được dùng khi sản phẩm có mẫu sản phẩm.");
      }
    }
    if ((normalized.status === "inactive" || normalized.status === "archived") && normalized.status !== current.status) {
      const activeVariantCount = await ProductVariantModel.countDocuments({ companyCode, productId: id, status: "active" });
      if (activeVariantCount > 0) throw new ProductCatalogValidationError("Hãy ngừng bán các SKU đang hoạt động trước khi ngừng sản phẩm.");
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
    await ProductCatalogModel.findOneAndUpdate({ _id: id, companyCode }, { $set: update, ...(clearBrand ? { $unset: { brandCode: 1 } } : {}) }, { new: true, runValidators: true }).lean();
    return this.get(companyCode, id);
  },

  async createVariant(companyCodeValue: unknown, productId: string, input: ProductVariantInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    assertObjectId(productId, "ID sản phẩm");
    const product = await ProductCatalogModel.findOne({ _id: productId, companyCode }).select("productType status").lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });
    if (product.status === "archived") throw new ProductCatalogValidationError("Không thể thêm SKU cho sản phẩm đã lưu trữ.");
    const variant = normalizeVariantInput(input, product.productType);
    if (variant.status === "active" && product.status !== "active") throw new ProductCatalogValidationError("Chỉ sản phẩm đang hoạt động mới được mở bán SKU.");
    await assertActiveUnit(companyCode, variant.unitCode);
    const document = await ProductVariantModel.create({ ...variant, companyCode, productId, createdBy, updatedBy: createdBy });
    return document.toObject();
  },

  async createVariants(companyCodeValue: unknown, productId: string, inputs: ProductVariantInput[], actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const createdBy = actorId(actor);
    assertObjectId(productId, "ID sản phẩm");
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 500) throw new ProductCatalogValidationError("Danh sách SKU phải có từ 1 đến 500 dòng.");
    const product = await ProductCatalogModel.findOne({ _id: productId, companyCode }).select("productType status").lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });
    if (product.status === "archived") throw new ProductCatalogValidationError("Không thể thêm SKU cho sản phẩm đã lưu trữ.");
    const variants = inputs.map((input) => normalizeVariantInput(input, product.productType));
    if (variants.some((variant) => variant.status === "active") && product.status !== "active") throw new ProductCatalogValidationError("Chỉ sản phẩm đang hoạt động mới được mở bán SKU.");
    const skuSet = new Set<string>();
    const barcodeSet = new Set<string>();
    for (const variant of variants) {
      if (skuSet.has(variant.sku)) throw new ProductCatalogValidationError(`SKU bị lặp trong danh sách: ${variant.sku}.`);
      skuSet.add(variant.sku);
      if (variant.barcode) {
        if (barcodeSet.has(variant.barcode)) throw new ProductCatalogValidationError(`Mã vạch bị lặp trong danh sách: ${variant.barcode}.`);
        barcodeSet.add(variant.barcode);
      }
    }
    const existing = await ProductVariantModel.find({ companyCode, $or: [{ sku: { $in: [...skuSet] } }, ...(barcodeSet.size ? [{ barcode: { $in: [...barcodeSet] } }] : [])] }).select("sku barcode").lean();
    if (existing.length) throw new ProductCatalogValidationError(`SKU hoặc mã vạch đã tồn tại: ${existing.map((item: any) => item.sku || item.barcode).join(", ")}.`);
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
      if (Object.prototype.hasOwnProperty.call(value, immutableField)) throw new ProductCatalogValidationError(`${immutableField} không thể thay đổi sau khi tạo SKU.`);
    }
    const current = await ProductVariantModel.findOne({ _id: id, companyCode }).lean();
    if (!current) throw Object.assign(new Error("Không tìm thấy SKU."), { statusCode: 404 });
    const product = await ProductCatalogModel.findOne({ _id: current.productId, companyCode }).select("productType").lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm của SKU."), { statusCode: 404 });
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
    if (normalized.status === "active" && product.status !== "active") throw new ProductCatalogValidationError("Chỉ sản phẩm đang hoạt động mới được mở bán SKU.");
    await assertActiveUnit(companyCode, normalized.unitCode);
    const update = { ...normalized, sku: current.sku, productId: current.productId, companyCode, updatedBy };
    const document = await ProductVariantModel.findOneAndUpdate({ _id: id, companyCode }, { $set: update }, { new: true, runValidators: true }).lean();
    return document;
  },

  async updateVariants(companyCodeValue: unknown, ids: string[], input: ProductVariantBulkUpdateInput, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length > 500) throw new ProductCatalogValidationError("Danh sách SKU phải có từ 1 đến 500 dòng.");
    uniqueIds.forEach((id) => assertObjectId(id, "ID SKU"));
    const updates: ProductVariantBulkUpdateInput = {};
    if (input?.status !== undefined) {
      assertVariantStatus(input.status);
      updates.status = input.status;
    }
    if (input?.trackingMode !== undefined) {
      if (!TRACKING_MODES.includes(input.trackingMode)) throw new ProductCatalogValidationError("Cách theo dõi kho không hợp lệ.");
      updates.trackingMode = input.trackingMode;
    }
    if (!Object.keys(updates).length) throw new ProductCatalogValidationError("Chưa chọn nội dung cần cập nhật.");
    const variants = await ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).lean();
    if (variants.length !== uniqueIds.length) throw new ProductCatalogValidationError("Một hoặc nhiều SKU không thuộc công ty này.");
    const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
    const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode }).select("productType status").lean();
    const productById = new Map(products.map((product: any) => [String(product._id), product]));
    if (updates.status === "active" && variants.some((variant: any) => productById.get(String(variant.productId))?.status !== "active")) throw new ProductCatalogValidationError("Chỉ sản phẩm đang hoạt động mới được mở bán SKU.");
    if (updates.trackingMode === "none" && variants.some((variant: any) => productById.get(String(variant.productId))?.productType !== "service")) throw new ProductCatalogValidationError("Sản phẩm hàng hóa phải theo dõi số lượng, lô hoặc số sê-ri.");
    await ProductVariantModel.updateMany({ _id: { $in: uniqueIds }, companyCode }, { $set: { ...updates, updatedBy } });
    return ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).sort({ sku: 1 }).lean();
  },

  async deleteVariants(companyCodeValue: unknown, ids: string[]) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length === 0 || uniqueIds.length > 500) throw new ProductCatalogValidationError("Danh sách SKU phải có từ 1 đến 500 dòng.");
    uniqueIds.forEach((id) => assertObjectId(id, "ID SKU"));
    const variants = await ProductVariantModel.find({ _id: { $in: uniqueIds }, companyCode }).select("productId sku").lean();
    if (variants.length !== uniqueIds.length) throw new ProductCatalogValidationError("Một hoặc nhiều SKU không thuộc công ty này.");
    const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
    const counts = await ProductVariantModel.aggregate([{ $match: { companyCode, productId: { $in: productIds } } }, { $group: { _id: "$productId", count: { $sum: 1 } } }]);
    const countByProduct = new Map(counts.map((item: any) => [String(item._id), Number(item.count)]));
    for (const productId of productIds) {
      if ((countByProduct.get(productId) || 0) <= variants.filter((variant: any) => String(variant.productId) === productId).length) throw new ProductCatalogValidationError("Mỗi sản phẩm phải giữ lại ít nhất một SKU.");
    }
    const [balance, ledger, receipt] = await Promise.all([
      InventoryBalanceModel.exists({ companyCode, variantId: { $in: uniqueIds } }),
      InventoryLedgerEntryModel.exists({ companyCode, variantId: { $in: uniqueIds } }),
      GoodsReceiptModel.exists({ companyCode, "items.variantId": { $in: uniqueIds } }),
    ]);
    if (balance || ledger || receipt) throw new ProductCatalogValidationError("SKU đã có tồn kho hoặc lịch sử giao dịch và không thể xóa. Hãy chuyển sang trạng thái Ngừng dùng.");
    await ProductVariantModel.deleteMany({ _id: { $in: uniqueIds }, companyCode });
    return { deletedIds: uniqueIds };
  },

  async deleteProduct(companyCodeValue: unknown, id: string, actor: unknown) {
    const companyCode = normalizeCompanyCode(companyCodeValue);
    const updatedBy = actorId(actor);
    assertObjectId(id, "ID sản phẩm");
    
    const product = await ProductCatalogModel.findOne({ _id: id, companyCode }).lean();
    if (!product) throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });

    const variants = await ProductVariantModel.find({ productId: id, companyCode }).select("_id").lean();
    const variantIds = variants.map(v => String(v._id));

    if (variantIds.length > 0) {
      const [balance, ledger, receipt] = await Promise.all([
        InventoryBalanceModel.exists({ companyCode, variantId: { $in: variantIds } }),
        InventoryLedgerEntryModel.exists({ companyCode, variantId: { $in: variantIds } }),
        GoodsReceiptModel.exists({ companyCode, "items.variantId": { $in: variantIds } }),
      ]);
      if (balance || ledger || receipt) throw new ProductCatalogValidationError("Sản phẩm đã có tồn kho hoặc lịch sử giao dịch và không thể xóa. Hãy chuyển sang trạng thái Ngừng dùng.");
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
