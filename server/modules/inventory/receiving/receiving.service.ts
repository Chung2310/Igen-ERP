import mongoose, { Types } from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { SupplierModel } from "../../../model/supplier.model";
import { getWarehouse } from "../warehouse/warehouse.service";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";

export class ReceivingValidationError extends Error { statusCode = 400; }

type Scope = { companyCode: string; branchId: string };
type Actor = { id?: string; email?: string; displayName?: string };

function companyCode(value: unknown) {
  const result = String(value || "").trim().toUpperCase();
  if (!result) throw new ReceivingValidationError("Tài khoản chưa được gắn với công ty.");
  return result;
}

function text(value: unknown, label: string, required = false) {
  const result = String(value || "").trim();
  if (required && !result) throw new ReceivingValidationError(`${label} là bắt buộc.`);
  return result;
}

function actorId(actor: Actor) {
  return text(actor.id, "Người thực hiện", true);
}

function codeFromName(prefix: string, value: string) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "ITEM";
  return `${prefix}-${slug}`;
}

function normalizeScope(scope: Scope): Scope {
  return { companyCode: companyCode(scope.companyCode), branchId: text(scope.branchId, "Chi nhánh", true) };
}

function normalizeItems(input: unknown) {
  if (!Array.isArray(input) || input.length === 0) throw new ReceivingValidationError("Phiếu nhập phải có ít nhất một sản phẩm.");
  return input.map((raw: any, index) => {
    const productId = text(raw?.productId, `Sản phẩm dòng ${index + 1}`, true);
    const variantId = text(raw?.variantId, `SKU dòng ${index + 1}`, true);
    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(variantId)) throw new ReceivingValidationError(`Sản phẩm/SKU dòng ${index + 1} không hợp lệ.`);
    const quantity = Number(raw?.quantity);
    const unitCost = Number(raw?.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ReceivingValidationError(`Số lượng dòng ${index + 1} phải lớn hơn 0.`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new ReceivingValidationError(`Giá nhập dòng ${index + 1} không hợp lệ.`);
    return { productId, variantId, quantity, unitCost, note: text(raw?.note, "Ghi chú") || undefined };
  });
}

async function ensureSupplierCode(company: string, name: string, requested?: unknown) {
  const requestedCode = text(requested, "Mã nhà cung cấp");
  const base = requestedCode ? requestedCode.toUpperCase() : codeFromName("NCC", name);
  let candidate = base;
  let suffix = 2;
  while (await SupplierModel.exists({ companyCode: company, code: candidate })) candidate = `${base.slice(0, 92)}-${suffix++}`;
  return candidate;
}

export async function listSuppliers(scope: { companyCode: string; q?: unknown; status?: unknown }) {
  const company = companyCode(scope.companyCode);
  const q = text(scope.q, "Từ khóa");
  const filter: Record<string, unknown> = { companyCode: company };
  if (q) filter.$or = [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { code: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { phone: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
  if (["active", "inactive"].includes(String(scope.status))) filter.status = String(scope.status);
  return SupplierModel.find(filter).sort({ status: 1, name: 1 }).lean();
}

export async function createSupplier(scope: { companyCode: string }, input: any, actor: Actor) {
  const company = companyCode(scope.companyCode);
  const name = text(input?.name, "Tên nhà cung cấp", true);
  const code = await ensureSupplierCode(company, name, input?.code);
  return SupplierModel.create({ companyCode: company, code, name, taxCode: text(input?.taxCode, "Mã số thuế") || undefined, phone: text(input?.phone, "Số điện thoại") || undefined, email: text(input?.email, "Email").toLowerCase() || undefined, address: text(input?.address, "Địa chỉ") || undefined, paymentTerms: text(input?.paymentTerms, "Điều khoản thanh toán") || undefined, notes: text(input?.notes, "Ghi chú") || undefined, status: input?.status === "inactive" ? "inactive" : "active", createdBy: actorId(actor), updatedBy: actorId(actor) });
}

export async function updateSupplier(scope: { companyCode: string }, id: string, input: any, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const company = companyCode(scope.companyCode);
  const updates: Record<string, unknown> = {};
  for (const field of ["name", "taxCode", "phone", "email", "address", "paymentTerms", "notes"] as const) if (input?.[field] !== undefined) updates[field] = text(input[field], field) || undefined;
  if (input?.status !== undefined) { if (!["active", "inactive"].includes(input.status)) throw new ReceivingValidationError("Trạng thái nhà cung cấp không hợp lệ."); updates.status = input.status; }
  updates.updatedBy = actorId(actor);
  const supplier = await SupplierModel.findOneAndUpdate({ _id: id, companyCode } as any, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp.");
  return supplier;
}

export async function deleteSupplier(scope: { companyCode: string }, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const company = companyCode(scope.companyCode);
  const supplier = await SupplierModel.findOne({ _id: id, companyCode: company }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp.");
  const hasReceipts = await GoodsReceiptModel.exists({ companyCode: company, supplierId: id });
  if (hasReceipts) throw new ReceivingValidationError("Nhà cung cấp đã có phiếu nhập và không thể xóa. Hãy chuyển sang trạng thái Ngừng dùng.");
  await SupplierModel.deleteOne({ _id: id, companyCode: company });
  return supplier;
}

async function resolveReceiptItems(company: string, rawItems: ReturnType<typeof normalizeItems>) {
  const productIds = [...new Set(rawItems.map((item) => item.productId))];
  const variantIds = [...new Set(rawItems.map((item) => item.variantId))];
  const [products, variants] = await Promise.all([
    ProductCatalogModel.find({ _id: { $in: productIds }, companyCode: company, productType: { $in: ["physical", "bundle"] }, status: { $in: ["active", "draft"] } }).lean(),
    ProductVariantModel.find({ _id: { $in: variantIds }, companyCode: company, status: "active" }).lean(),
  ]);
  const productById = new Map(products.map((item: any) => [String(item._id), item]));
  const variantById = new Map(variants.map((item: any) => [String(item._id), item]));
  return rawItems.map((item) => {
    const product: any = productById.get(item.productId);
    const variant: any = variantById.get(item.variantId);
    if (!product || !variant || String(variant.productId) !== item.productId) throw new ReceivingValidationError(`Sản phẩm/SKU ${item.variantId} không thuộc công ty hoặc đã ngừng dùng.`);
    return { ...item, sku: variant.sku, productName: product.name, lineTotal: item.quantity * item.unitCost };
  });
}

async function receiptCode(scope: Scope) {
  const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).select("code").lean();
  if (!branch) throw new ReceivingValidationError("Chi nhánh không hợp lệ.");
  const prefix = `PN-${String(branch.code || "CN").toUpperCase().replace(/[^A-Z0-9-]/g, "")}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const count = await GoodsReceiptModel.countDocuments({ companyCode: scope.companyCode, branchId: scope.branchId, receiptCode: { $regex: `^${prefix}-` } });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function listReceipts(rawScope: Scope, query: any = {}) {
  const scope = normalizeScope(rawScope);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter: any = { ...scope, ...(query.status && ["draft", "confirmed", "cancelled"].includes(String(query.status)) ? { status: String(query.status) } : {}) };
  const [items, total] = await Promise.all([GoodsReceiptModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), GoodsReceiptModel.countDocuments(filter)]);
  return { items, total, page, limit };
}

export async function createReceipt(rawScope: Scope, input: any, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const supplierId = text(input?.supplierId, "Nhà cung cấp", true);
  if (!Types.ObjectId.isValid(supplierId)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const supplier = await SupplierModel.findOne({ _id: supplierId, companyCode: scope.companyCode, status: "active" }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp đang hoạt động.");
  const warehouse = input?.warehouseId ? await getWarehouse(scope.companyCode, scope.branchId, String(input.warehouseId)) : await (await import("../warehouse/warehouse.service")).ensureDefaultWarehouse(scope.companyCode, scope.branchId);
  if (!warehouse) throw new ReceivingValidationError("Không tìm thấy kho nhập.");
  const items = await resolveReceiptItems(scope.companyCode, normalizeItems(input?.items));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return GoodsReceiptModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id), receiptCode: await receiptCode(scope), supplierId, supplierName: supplier.name, status: "draft", receivedAt: input?.receivedAt ? new Date(input.receivedAt) : undefined, items, subtotal, notes: text(input?.notes, "Ghi chú") || undefined, createdBy: actorId(actor), createdByName: actor.email || actor.id, version: 0 });
}

export async function confirmReceipt(rawScope: Scope, id: string, actor: Actor) {
  const scope = normalizeScope(rawScope);
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Phiếu nhập không hợp lệ.");
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const receipt: any = await GoodsReceiptModel.findOne({ _id: id, ...scope, status: "draft" }).session(session);
      if (!receipt) {
        const confirmed = await GoodsReceiptModel.findOne({ _id: id, ...scope, status: "confirmed" }).session(session).lean();
        if (confirmed) { result = confirmed; return; }
        throw new ReceivingValidationError("Phiếu nhập không thể xác nhận.");
      }
      const movement = await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: receipt.warehouseId, direction: "in", purpose: "purchase", sourceType: "goods-receipt", sourceId: String(receipt._id), sourceCode: receipt.receiptCode, idempotencyKey: `goods-receipt:${receipt._id}:confirm`, operatorName: actor.email || actor.id || "", items: receipt.items.map((item: any) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, productName: item.productName, quantity: item.quantity, unitCost: item.unitCost, lineTotal: item.lineTotal })), reason: `Nhập hàng ${receipt.receiptCode}`, session, writeLegacyStockLog: true });
      receipt.status = "confirmed"; receipt.confirmedBy = actorId(actor); receipt.confirmedByName = actor.email || actor.id; receipt.confirmedAt = new Date(); receipt.version += 1; await receipt.save({ session });
      result = receipt.toObject();
      void movement;
    });
  } finally { await session.endSession(); }
  return result;
}

export async function cancelReceipt(rawScope: Scope, id: string, reason: unknown, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const cancelReason = text(reason, "Lý do hủy", true);
  const receipt = await GoodsReceiptModel.findOneAndUpdate({ _id: id, ...scope, status: "draft" }, { $set: { status: "cancelled", cancelledBy: actorId(actor), cancelledAt: new Date(), cancelReason }, $inc: { version: 1 } }, { new: true }).lean();
  if (!receipt) throw new ReceivingValidationError("Chỉ được hủy phiếu nhập đang ở trạng thái nháp.");
  return receipt;
}
