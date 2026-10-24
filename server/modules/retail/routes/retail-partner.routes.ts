import { Router } from "express";
import { Types } from "mongoose";
import { requirePermission } from "../../../middleware/auth";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { SupplierModel } from "../../../model/supplier.model";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { UserModel } from "../../../model/user.model";
import { retailScopeFromRequest } from "../contracts";
import { RETAIL_PARTNER_ROLES, RetailPartnerModel } from "../models/retail-partner.model";
import { listRetailBasePolicies, listRetailProductCommissions, saveRetailBasePolicy, saveRetailProductCommissions } from "../services/retail-commission-policy.service";

export const retailPartnerRoutes = Router();
const read = requirePermission(["retail-partner:read", "retail-partner:manage", "retail-partner-policy:manage"]) as any;
const manage = requirePermission("retail-partner:manage") as any;
const policyManage = requirePermission("retail-partner-policy:manage") as any;
const picker = requirePermission(["retail:manage", "repair:manage", "retail-partner:read", "retail-partner:manage"]) as any;
const self = requirePermission(["retail-partner-self:read", "retail-partner-self:manage"]) as any;

function companyCode(req: any) {
  return retailScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode }).companyCode;
}

function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function id(value: unknown) {
  const result = String(value || "");
  if (!Types.ObjectId.isValid(result)) throw bad("ID không hợp lệ.");
  return result;
}

export function normalizeRetailPartnerInput(body: any) {
  const code = String(body?.code || "").trim().toUpperCase();
  const name = String(body?.name || "").trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,59}$/.test(code)) throw bad("Mã đối tác chỉ gồm chữ, số, dấu gạch nối hoặc gạch dưới (tối đa 60 ký tự).");
  if (!name || name.length > 200) throw bad("Tên đối tác là bắt buộc và không quá 200 ký tự.");
  if (!Array.isArray(body?.roles) || body.roles.length !== 1 || body.roles.some((role: unknown) => !RETAIL_PARTNER_ROLES.includes(role as any))) {
    throw bad("Chọn một vai trò đối tác hợp lệ.");
  }
  const roles = body.roles as (typeof RETAIL_PARTNER_ROLES)[number][];
  const supplierId = body.supplierId ? id(body.supplierId) : undefined;
  const userId = body.userId ? id(body.userId) : undefined;
  const customerId = body.customerId ? id(body.customerId) : undefined;
  if (supplierId && !roles.includes("supplier")) throw bad("Liên kết nhà cung cấp cần vai trò nhà cung cấp.");
  if (userId && !roles.includes("collaborator")) throw bad("Liên kết tài khoản cần vai trò cộng tác viên bán lẻ.");
  if (customerId && !roles.includes("dealer")) throw bad("Liên kết khách hàng cần vai trò đại lý.");
  if (body.status !== undefined && !["active", "inactive"].includes(body.status)) throw bad("Trạng thái đối tác không hợp lệ.");
  return {
    code, name, roles,
    phone: String(body.phone || "").trim().slice(0, 30),
    email: String(body.email || "").trim().toLowerCase().slice(0, 200),
    address: String(body.address || "").trim().slice(0, 500),
    status: (body.status || "active") as "active" | "inactive",
    supplierId, userId, customerId,
  };
}

async function validatedInput(req: any, existing?: any) {
  const input = normalizeRetailPartnerInput(req.body);
  const company = companyCode(req);
  if (existing?.supplierId && input.roles.includes("supplier")) {
    if (input.supplierId && input.supplierId !== existing.supplierId) throw bad("Không được thay liên kết nhà cung cấp đã lưu.");
    input.supplierId = existing.supplierId;
  } else if (!input.roles.includes("supplier")) {
    input.supplierId = undefined;
  }
  if (existing?.userId && input.roles.includes("collaborator")) {
    if (input.userId && input.userId !== existing.userId) throw bad("Không được thay tài khoản đã liên kết.");
    input.userId = existing.userId;
  } else if (!input.roles.includes("collaborator")) {
    input.userId = undefined;
  }
  if (existing?.customerId && input.roles.includes("dealer")) {
    if (input.customerId && input.customerId !== existing.customerId) throw bad("Không được thay khách hàng đã liên kết với đại lý.");
    input.customerId = existing.customerId;
  } else if (!input.roles.includes("dealer")) {
    input.customerId = undefined;
  }
  if (input.supplierId && !await SupplierModel.exists({ _id: input.supplierId, companyCode: company })) throw bad("Nhà cung cấp không thuộc công ty.");
  if (input.userId && !await UserModel.exists({ _id: input.userId, companyCode: company })) throw bad("Tài khoản không thuộc công ty.");
  if (input.customerId && !await CustomerModel.exists({ _id: input.customerId, companyCode: company })) throw bad("Khách hàng không thuộc công ty.");
  return input;
}

function route(fn: (req: any) => Promise<any>, created = false) {
  return async (req: any, res: any) => {
    try { res.status(created ? 201 : 200).json({ success: true, data: await fn(req) }); }
    catch (error: any) {
      const duplicate = error?.code === 11000;
      res.status(duplicate ? 409 : error?.status || 400).json({ success: false, error: duplicate ? "Mã, tài khoản hoặc nhà cung cấp đã liên kết với đối tác khác." : error.message });
    }
  };
}

retailPartnerRoutes.get("/collaborators", picker, route(async (req) =>
  RetailPartnerModel.find({ companyCode: companyCode(req), roles: "collaborator", status: "active" })
    .select("code name").sort({ name: 1 }).limit(1000).lean()));

retailPartnerRoutes.get("/suppliers", manage, route(async (req) =>
  SupplierModel.find({ companyCode: companyCode(req), status: "active" })
    .select("code name").sort({ name: 1 }).limit(1000).lean()));

retailPartnerRoutes.get("/users", manage, route(async (req) =>
  UserModel.find({ companyCode: companyCode(req), isActive: { $ne: false } })
    .select("displayName email").sort({ displayName: 1 }).limit(1000).lean()));

retailPartnerRoutes.get("/customers", manage, route(async (req) =>
  CustomerModel.find({ companyCode: companyCode(req), status: "active" })
    .select("customerCode name phone").sort({ name: 1 }).limit(1000).lean()));

retailPartnerRoutes.get("/commission-policies", policyManage, route(async (req) => listRetailBasePolicies(companyCode(req))));
retailPartnerRoutes.post("/commission-policies", policyManage, route(async (req) => saveRetailBasePolicy(companyCode(req), String(req.user.id), req.body || {}), true));
retailPartnerRoutes.patch("/commission-policies/:id", policyManage, route(async (req) => saveRetailBasePolicy(companyCode(req), String(req.user.id), req.body || {}, id(req.params.id))));
retailPartnerRoutes.get("/product-commissions", policyManage, route(async (req) => listRetailProductCommissions(companyCode(req))));
retailPartnerRoutes.put("/product-commissions", policyManage, route(async (req) => saveRetailProductCommissions(companyCode(req), String(req.user.id), req.body || {})));

retailPartnerRoutes.get("/policy-products", policyManage, route(async (req) => {
  const company = companyCode(req);
  const variants = await ProductVariantModel.find({ companyCode: company, status: "active" })
    .select("productId sku displayName").sort({ sku: 1 }).limit(1000).lean();
  const productIds = [...new Set(variants.map((variant) => String(variant.productId)))];
  const products = await ProductCatalogModel.find({ companyCode: company, _id: { $in: productIds }, status: "active" })
    .select("name").lean();
  const byId = new Map(products.map((product) => [String(product._id), product.name]));
  return variants.flatMap((variant) => {
    const productName = byId.get(String(variant.productId));
    return productName ? [{ _id: String(variant._id), sku: variant.sku, name: productName, variantName: variant.displayName || variant.sku }] : [];
  });
}));

retailPartnerRoutes.get("/me", self, route(async (req) => {
  const partner = await RetailPartnerModel.findOne({ companyCode: companyCode(req), userId: String(req.user.id), status: "active" }).lean();
  if (!partner) throw bad("Tài khoản chưa được liên kết với đối tác bán lẻ.", 404);
  return partner;
}));

retailPartnerRoutes.get("/", read, route(async (req) => {
  const filter: Record<string, unknown> = { companyCode: companyCode(req) };
  if (req.query.role) {
    if (!RETAIL_PARTNER_ROLES.includes(req.query.role)) throw bad("Vai trò không hợp lệ.");
    filter.roles = req.query.role;
  }
  const partners = await RetailPartnerModel.find(filter).sort({ name: 1 }).limit(1000).lean();
  const supplierIds = partners.flatMap((partner) => partner.supplierId ? [partner.supplierId] : []);
  const suppliers = await SupplierModel.find({ companyCode: filter.companyCode, _id: { $in: supplierIds } }).select("name code status").lean();
  const byId = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
  return partners.map((partner) => ({ ...partner, supplier: partner.supplierId ? byId.get(partner.supplierId) || null : null }));
}));

retailPartnerRoutes.post("/", manage, route(async (req) => {
  const input = await validatedInput(req);
  return RetailPartnerModel.create({ ...input, companyCode: companyCode(req), createdBy: req.user.id, updatedBy: req.user.id });
}, true));

retailPartnerRoutes.patch("/:id", manage, route(async (req) => {
  const company = companyCode(req);
  const partner = await RetailPartnerModel.findOne({ companyCode: company, _id: id(req.params.id) });
  if (!partner) throw bad("Không tìm thấy đối tác bán lẻ.", 404);
  const input = await validatedInput(req, partner);
  Object.assign(partner, input, { updatedBy: req.user.id });
  await partner.save();
  return partner;
}));
