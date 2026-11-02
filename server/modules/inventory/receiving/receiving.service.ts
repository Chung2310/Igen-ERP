import { type CustomerScope } from "../../customer-management/customer-branch-scope";
import { FinanceDebtModel } from "../../finance/models/financial-reporting.model";
import { financeToday, validDay, moneyInput } from "../../finance/services/financial-calculations";
import mongoose, { Types } from "mongoose";
import { inInventoryTransaction } from "../inventory-transaction";
import { isReceiptCodeCollision, nextReceiptCode, receiptBusinessDay } from "./receipt-number.service";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { SupplierModel } from "../../../model/supplier.model";
import { getWarehouse } from "../warehouse/warehouse.service";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { validateReceivingSerialLines } from "../serials/serial-receiving-validation";
import { registerSerialBatch } from "../serials/serial-unit.service";
import { computeWarrantyEnd } from "../serials/warranty-clock";

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
    const rawWarrantyMonths = raw?.supplierWarrantyMonths;
    let supplierWarrantyMonths: number | undefined;
    if (rawWarrantyMonths !== undefined && rawWarrantyMonths !== null && rawWarrantyMonths !== "") {
      supplierWarrantyMonths = Number(rawWarrantyMonths);
      if (!Number.isFinite(supplierWarrantyMonths) || supplierWarrantyMonths < 0 || supplierWarrantyMonths > 1200) {
        throw new ReceivingValidationError(`Bảo hành nhà cung cấp dòng ${index + 1} phải từ 0 đến 1200 tháng.`);
      }
    }
    const unitDetails = Array.isArray(raw?.unitDetails) ? raw.unitDetails.map((unit: any) => ({
      ...(text(unit?.internalBarcode, "Mã quản lý") ? { internalBarcode: text(unit.internalBarcode, "Mã quản lý") } : {}),
      ...(text(unit?.serialNumber, "Serial") ? { serialNumber: text(unit.serialNumber, "Serial") } : {}),
      ...(text(unit?.imei1, "IMEI 1") ? { imei1: text(unit.imei1, "IMEI 1") } : {}),
      ...(text(unit?.imei2, "IMEI 2") ? { imei2: text(unit.imei2, "IMEI 2") } : {}),
    })) : undefined;
    return { productId, variantId, barcode: text(raw?.barcode, "Mã vạch") || undefined, quantity, unitCost, supplierWarrantyMonths, note: text(raw?.note, "Ghi chú") || undefined, unitDetails };
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

export async function listSuppliers(scope: CustomerScope & { q?: unknown; status?: unknown }) {
  const company = companyCode(scope.companyCode);
  const q = text(scope.q, "Từ khóa");
  const filter: Record<string, unknown> = { companyCode: company };
  if (q) filter.$or = [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { code: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { phone: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }];
  if (["active", "inactive"].includes(String(scope.status))) filter.status = String(scope.status);
  return SupplierModel.find(filter).sort({ status: 1, name: 1 }).lean();
}

export async function createSupplier(scope: CustomerScope, input: any, actor: Actor) {
  const company = companyCode(scope.companyCode);
  const name = text(input?.name, "Tên nhà cung cấp", true);
  const code = await ensureSupplierCode(company, name, input?.code);
  return SupplierModel.create({ companyCode: company, code, name, taxCode: text(input?.taxCode, "Mã số thuế") || undefined, phone: text(input?.phone, "Số điện thoại") || undefined, email: text(input?.email, "Email").toLowerCase() || undefined, address: text(input?.address, "Địa chỉ") || undefined, paymentTerms: text(input?.paymentTerms, "Điều khoản thanh toán") || undefined, notes: text(input?.notes, "Ghi chú") || undefined, status: input?.status === "inactive" ? "inactive" : "active", createdBy: actorId(actor), updatedBy: actorId(actor) });
}

export async function updateSupplier(scope: CustomerScope, id: string, input: any, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const company = companyCode(scope.companyCode);
  const updates: Record<string, unknown> = {};
  for (const field of ["name", "taxCode", "phone", "email", "address", "paymentTerms", "notes"] as const) if (input?.[field] !== undefined) updates[field] = text(input[field], field) || undefined;
  if (input?.status !== undefined) { if (!["active", "inactive"].includes(input.status)) throw new ReceivingValidationError("Trạng thái nhà cung cấp không hợp lệ."); updates.status = input.status; }
  updates.updatedBy = actorId(actor);
  const supplier = await SupplierModel.findOneAndUpdate({ _id: id, ...{ companyCode: company } }, { $set: updates }, { returnDocument: 'after', runValidators: true }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp.");
  return supplier;
}

export async function deleteSupplier(scope: CustomerScope, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const company = companyCode(scope.companyCode);
  const supplier = await SupplierModel.findOne({ _id: id, ...{ companyCode: company } }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp.");
  const hasReceipts = await GoodsReceiptModel.exists({ companyCode: company, supplierId: id });
  if (hasReceipts) throw new ReceivingValidationError("Nhà cung cấp đã có phiếu nhập và không thể xóa. Hãy chuyển sang trạng thái Ngừng dùng.");
  await SupplierModel.deleteOne({ _id: id, ...{ companyCode: company } });
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
    const barcode = item.barcode || variant.barcode;
    if (item.barcode && item.barcode !== variant.barcode) throw new ReceivingValidationError("Mã vạch của SKU " + variant.sku + " không khớp.");
    // Không gửi kèm thì chốt theo chính sách bảo hành đang khai ở SKU.
    const supplierWarrantyMonths = item.supplierWarrantyMonths ?? (Number.isFinite(Number(variant.supplierWarrantyMonths)) ? Number(variant.supplierWarrantyMonths) : undefined);
    return { ...item, barcode, sku: variant.sku, productName: product.name, trackingMode: variant.trackingMode, supplierWarrantyMonths, lineTotal: item.quantity * item.unitCost };
  });
}

export async function listReceipts(rawScope: Scope, query: any = {}) {
  const scope = normalizeScope(rawScope);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter: any = { ...scope, ...(query.status && ["draft", "pending", "receiving", "confirmed", "cancelled"].includes(String(query.status)) ? { status: String(query.status) } : {}) };
  if (query.q && typeof query.q === "string" && query.q.trim()) {
    const qTrim = query.q.trim();
    const qRegex = new RegExp(qTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { receiptCode: qRegex },
      { supplierName: qRegex },
      { orderCode: qRegex },
    ];
  }
  const from = String(query.from || "");
  const to = String(query.to || "");
  if (from || to) {
    const validDay = (value: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) return false;
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
    };
    if ((from && !validDay(from)) || (to && !validDay(to)) || (from && to && from > to)) {
      throw new ReceivingValidationError("Khoảng thời gian lọc phiếu nhập không hợp lệ.");
    }
    filter.createdAt = {
      ...(from ? { $gte: new Date(`${from}T00:00:00+07:00`) } : {}),
      ...(to ? { $lte: new Date(`${to}T23:59:59.999+07:00`) } : {}),
    };
  }
  const [items, total] = await Promise.all([GoodsReceiptModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), GoodsReceiptModel.countDocuments(filter)]);
  return { items, total, page, limit };
}

function receiptFinanceTerms(input: any, subtotal: number) {
  if (!input) return undefined;
  const dueOn = validDay(input.dueOn), paidAmount = moneyInput(input.paidAmount);
  if (paidAmount > subtotal) throw new ReceivingValidationError("Đã trả không được vượt giá trị phiếu nhập.");
  if (!["cash", "bank", ""].includes(String(input.paymentMethod || ""))) throw new ReceivingValidationError("Phương thức thanh toán không hợp lệ.");
  return { dueOn, paidAmount, paymentMethod: String(input.paymentMethod || "") };
}
async function recordReceiptDebt(receipt: any, session: any) {
  if (!receipt.financeTerms) return;
  const amount = receipt.subtotal - receipt.financeTerms.paidAmount;
  await FinanceDebtModel.updateOne({ companyCode: receipt.companyCode, sourceReceiptId: String(receipt._id) }, { $setOnInsert: { companyCode: receipt.companyCode, branchId: receipt.branchId, sourceReceiptId: String(receipt._id), direction: "payable", partyKind: "supplier", partyId: receipt.supplierId, partyName: receipt.supplierName, reference: receipt.receiptCode, amount, balance: amount, occurredOn: financeToday(receipt.confirmedAt), dueOn: receipt.financeTerms.dueOn, createdBy: receipt.confirmedBy, version: 0 } }, { upsert: true, session });
}
export async function createReceipt(rawScope: Scope, input: any, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const supplierId = text(input?.supplierId, "Nhà cung cấp", true);
  if (!Types.ObjectId.isValid(supplierId)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const supplier = await SupplierModel.findOne({ _id: supplierId, companyCode: scope.companyCode, status: "active" }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp đang hoạt động.");
  const warehouse = input?.warehouseId ? await getWarehouse(scope.companyCode, scope.branchId, String(input.warehouseId)) : await (await import("../warehouse/warehouse.service")).ensureDefaultWarehouse(scope.companyCode, scope.branchId);
  if (!warehouse) throw new ReceivingValidationError("Không tìm thấy kho nhập.");
  const rawItems = normalizeItems(input?.items);
  const items = (await resolveReceiptItems(scope.companyCode, rawItems)).map((item: any, index) => ({ ...item, serialNumbers: Array.isArray(input?.items?.[index]?.serialNumbers) ? input.items[index].serialNumbers : undefined }));
  validateReceivingSerialLines(items as any, false);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const payload = { companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id), supplierId, supplierName: supplier.name, status: "draft" as const, receivedAt: input?.receivedAt ? new Date(input.receivedAt) : undefined, items, subtotal, financeTerms: receiptFinanceTerms(input.financeTerms, subtotal), notes: text(input?.notes, "Ghi chú") || undefined, createdBy: actorId(actor), createdByName: actor.email || actor.id, version: 0 };
  const businessDay = receiptBusinessDay();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const receiptCode = await nextReceiptCode(scope, businessDay);
    try {
      return (await GoodsReceiptModel.create({ ...payload, receiptCode })).toObject();
    } catch (error) {
      if (!isReceiptCodeCollision(error)) throw error;
    }
  }
  throw Object.assign(new Error("Mã phiếu nhập liên tục bị trùng. Hãy kiểm tra bộ đếm trước khi thử lại."), { statusCode: 409 });
}

export async function updateReceipt(rawScope: Scope, id: string, input: any, actor: Actor) {
  const scope = normalizeScope(rawScope);
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Phiếu nhập không hợp lệ.");
  const supplierId = text(input?.supplierId, "Nhà cung cấp", true);
  if (!Types.ObjectId.isValid(supplierId)) throw new ReceivingValidationError("Nhà cung cấp không hợp lệ.");
  const supplier = await SupplierModel.findOne({ _id: supplierId, companyCode: scope.companyCode, status: "active" }).lean();
  if (!supplier) throw new ReceivingValidationError("Không tìm thấy nhà cung cấp đang hoạt động.");
  const current = await GoodsReceiptModel.findOne({ _id: id, ...scope }).lean();
  if (!current) throw new ReceivingValidationError("Không tìm thấy phiếu nhập.");
  if (current.status !== "draft") throw new ReceivingValidationError("Chỉ được sửa phiếu nhập ở trạng thái Nháp.");
  const rawItems = normalizeItems(input?.items);
  const items = (await resolveReceiptItems(scope.companyCode, rawItems)).map((item: any, index) => ({ ...item, serialNumbers: Array.isArray(input?.items?.[index]?.serialNumbers) ? input.items[index].serialNumbers : undefined }));
  validateReceivingSerialLines(items as any, false);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const updated = await GoodsReceiptModel.findOneAndUpdate({ _id: id, ...scope, status: "draft", version: current.version }, { $set: { supplierId, supplierName: supplier.name, items, subtotal, financeTerms: receiptFinanceTerms(input.financeTerms === undefined ? current.financeTerms : input.financeTerms, subtotal) || null, notes: text(input?.notes, "Ghi chú") || undefined, updatedBy: actorId(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true }).lean();
  if (!updated) throw new ReceivingValidationError("Phiếu nhập đã thay đổi, vui lòng tải lại rồi sửa lại.");
  return updated;
}

export async function confirmReceipt(rawScope: Scope, id: string, actor: Actor) {
  const scope = normalizeScope(rawScope);
  if (!Types.ObjectId.isValid(id)) throw new ReceivingValidationError("Phiếu nhập không hợp lệ.");
  return inInventoryTransaction(async (session) => {
    const receipt: any = await GoodsReceiptModel.findOne({ _id: id, ...scope, status: "receiving" }).session(session || null);
    if (!receipt) {
      const confirmed = await GoodsReceiptModel.findOne({ _id: id, ...scope, status: "confirmed" }).session(session || null).lean();
      if (confirmed) { await recordReceiptDebt(confirmed, session); return confirmed; }
      throw new ReceivingValidationError("Phiếu nhập phải ở trạng thái Đang nhập kho mới có thể hoàn thành.");
    }
    validateReceivingSerialLines(receipt.items as any[], true);
    const movement = await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: receipt.warehouseId, direction: "in", purpose: "purchase", sourceType: "goods-receipt", sourceId: String(receipt._id), sourceCode: receipt.receiptCode, idempotencyKey: `goods-receipt:${receipt._id}:confirm`, operatorName: actor.email || actor.id || "", items: receipt.items.map((item: any) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, productName: item.productName, quantity: item.quantity, unitCost: item.unitCost, lineTotal: item.lineTotal })), reason: `Nhập hàng ${receipt.receiptCode}`, session, writeLegacyStockLog: true });
    for (const item of receipt.items as any[]) if (["serial", "unit_barcode"].includes(item.trackingMode)) {
      const details = Array.isArray(item.unitDetails) ? item.unitDetails : [];
      const serialNumbers = item.trackingMode === "serial" ? (item.serialNumbers || []).map((value: string) => value.trim()) : undefined;
      const supplierMonths = Number(item.supplierWarrantyMonths ?? item.warrantyMonths ?? 0);
      const startAt = receipt.receivedAt || receipt.confirmedAt || new Date();
      const registered = await registerSerialBatch({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(receipt.warehouseId) }, { productId: item.productId, variantId: item.variantId, sku: item.sku, productName: item.productName, quantity: Number(item.quantity), serialNumbers, unitDetails: details, documentType: "goods-receipt", documentId: String(receipt._id), supplierWarranty: supplierMonths > 0 ? { supplierId: receipt.supplierId, supplierName: receipt.supplierName, receiptId: String(receipt._id), receiptCode: receipt.receiptCode, months: supplierMonths, startAt, startSource: "receipt", endAt: computeWarrantyEnd(startAt, supplierMonths) } : undefined }, { id: actorId(actor), name: actor.email || actor.id || "" }, session);
      item.unitDetails = registered.map((unit: any) => ({ internalBarcode: unit.internalBarcode, serialNumber: item.trackingMode === "serial" ? unit.serialNumber : unit.serialNumber === unit.internalBarcode ? undefined : unit.serialNumber, imei1: unit.imei1, imei2: unit.imei2 }));
    }
    receipt.status = "confirmed"; receipt.confirmedBy = actorId(actor); receipt.confirmedByName = actor.email || actor.id; receipt.confirmedAt = new Date(); receipt.version += 1; await receipt.save({ session });
    await recordReceiptDebt(receipt, session);
    void movement;
    return receipt.toObject();
  });
}

export async function submitReceipt(rawScope: Scope, id: string, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const current = await GoodsReceiptModel.findOne({ _id: id, ...scope, status: "draft" }).lean();
  if (!current) throw new ReceivingValidationError("Chỉ có thể gửi xác nhận phiếu đang ở trạng thái Nháp.");
  validateReceivingSerialLines(current.items as any[], true);
  const receipt = await GoodsReceiptModel.findOneAndUpdate({ _id: id, ...scope, status: "draft", version: current.version }, { $set: { status: "pending" }, $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  if (!receipt) throw new ReceivingValidationError("Phiếu nhập vừa thay đổi. Vui lòng tải lại rồi gửi xác nhận.");
  return receipt;
}

export async function startReceiving(rawScope: Scope, id: string, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const receipt = await GoodsReceiptModel.findOneAndUpdate({ _id: id, ...scope, status: "pending" }, { $set: { status: "receiving" }, $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  if (!receipt) throw new ReceivingValidationError("Chỉ có thể bắt đầu nhập kho với phiếu Chờ xác nhận.");
  return receipt;
}

export async function cancelReceipt(rawScope: Scope, id: string, reason: unknown, actor: Actor) {
  const scope = normalizeScope(rawScope);
  const cancelReason = text(reason, "Lý do hủy", true);
  const receipt = await GoodsReceiptModel.findOneAndUpdate({ _id: id, ...scope, status: { $in: ["draft", "pending"] } }, { $set: { status: "cancelled", cancelledBy: actorId(actor), cancelledAt: new Date(), cancelReason }, $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  if (!receipt) throw new ReceivingValidationError("Chỉ được hủy phiếu ở trạng thái Nháp hoặc Chờ xác nhận.");
  return receipt;
}
