import type { ClientSession } from "mongoose";
import { runInTransaction } from "../../../config/database";
import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";
import type { ISerialUnit, SerialUnitStatus } from "./serial-unit.interface";
import { assertSerialTransition, normalizeSerialNumber } from "./serial-state";
import { BranchModel } from "../../../model/branch.model";
import { generateInternalBarcode, normalizeInternalBarcode } from "./unit-barcode-validation";
import { computeWarrantyEnd } from "./warranty-clock";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ensureDefaultWarehouse } from "../warehouse/warehouse.service";

export interface SerialScope { companyCode: string; branchId: string; warehouseId?: string }
export interface SerialActor { id: string; name: string }
export interface RegisterSerialInput extends Pick<ISerialUnit, "productId" | "sku" | "productName"> { variantId?: string; internalBarcode?: string; serialNumber: string; warehouseId?: string; documentType?: string; documentId?: string; supplierWarranty?: ISerialUnit["supplierWarranty"] }
export interface TransitionSerialInput { toStatus: SerialUnitStatus; eventType: string; reason?: string; documentType?: string; documentId?: string }
export interface TransferSerialInput { toBranchId: string; toWarehouseId?: string; documentType?: string; documentId?: string; reason: string }
export interface RegisterSerialBatchInput extends Omit<RegisterSerialInput, "serialNumber" | "internalBarcode"> { serialNumbers: string[]; internalBarcodes?: string[] }

function scoped(scope: SerialScope) { return { companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}) }; }

export async function registerSerialUnit(scope: SerialScope, input: RegisterSerialInput, actor: SerialActor, session?: ClientSession) {
  const normalizedSerialNumber = normalizeSerialNumber(input.serialNumber);
  const internalBarcode = input.internalBarcode || generateInternalBarcode(input.sku, new Date().toISOString().slice(0, 10).replace(/-/g, ""), Date.now() % 1000000);
  const normalizedInternalBarcode = normalizeInternalBarcode(internalBarcode);
  const query = new SerialUnitModel({ ...scoped(scope), ...input, internalBarcode: internalBarcode.trim(), normalizedInternalBarcode, serialNumber: input.serialNumber.trim(), normalizedSerialNumber, status: "in_stock", createdBy: actor.id, updatedBy: actor.id });
  if (session) query.$session(session);
  try {
    const saved = await query.save();
    const event = new SerialEventModel({ ...scoped(scope), serialUnitId: String(saved._id), serialNumber: saved.serialNumber, eventType: "received", toStatus: "in_stock", documentType: input.documentType, documentId: input.documentId, actorId: actor.id, actorName: actor.name });
    if (session) event.$session(session);
    await event.save();
    return saved.toObject();
  } catch (error: any) {
    if (error?.code === 11000) throw Object.assign(new Error("Mã vạch nội bộ hoặc IMEI/serial đã tồn tại trong doanh nghiệp."), { statusCode: 409, code: "UNIT_ID_DUPLICATE" });
    throw error;
  }
}

export async function registerSerialBatch(scope: SerialScope, input: RegisterSerialBatchInput, actor: SerialActor, session?: ClientSession) {
  const serialNumbers = Array.isArray(input.serialNumbers) ? input.serialNumbers : [];
  const internalBarcodes = Array.isArray(input.internalBarcodes) ? input.internalBarcodes : [];
  if (!serialNumbers.length || serialNumbers.length > 500) throw Object.assign(new Error("Danh sách IMEI/serial phải có từ 1 đến 500 mã."), { statusCode: 400 });
  const resolvedBarcodes = internalBarcodes.length ? internalBarcodes : serialNumbers.map((_, index) => generateInternalBarcode(input.sku, new Date().toISOString().slice(0, 10).replace(/-/g, ""), Date.now() + index));
  if (resolvedBarcodes.length !== serialNumbers.length) throw Object.assign(new Error("Danh sách mã vạch nội bộ phải bằng số lượng đơn vị."), { statusCode: 400 });
  const normalized = serialNumbers.map(normalizeSerialNumber);
  if (new Set(normalized).size !== normalized.length) throw Object.assign(new Error("Danh sách IMEI/serial bị trùng."), { statusCode: 400 });
  const normalizedBarcodes = resolvedBarcodes.map(normalizeInternalBarcode);
  if (new Set(normalizedBarcodes).size !== normalizedBarcodes.length) throw Object.assign(new Error("Danh sách mã vạch nội bộ bị trùng."), { statusCode: 400 });
  if (session) {
    const created: any[] = [];
    for (let i = 0; i < normalized.length; i += 1) created.push(await registerSerialUnit(scope, { ...input, serialNumber: serialNumbers[i], internalBarcode: resolvedBarcodes[i] }, actor, session));
    return created;
  }
  return runInTransaction(async (transactionSession) => {
    const created: any[] = [];
    for (let i = 0; i < normalized.length; i += 1) created.push(await registerSerialUnit(scope, { ...input, serialNumber: serialNumbers[i], internalBarcode: resolvedBarcodes[i] }, actor, transactionSession));
    return created;
  });
}

export async function listSerialUnits(scope: SerialScope, filters: { serial?: string; sku?: string; productId?: string; variantId?: string; trackingMode?: "serial" | "unit_barcode"; forSale?: boolean; status?: SerialUnitStatus; page?: number; limit?: number } = {}) {
  const page = Math.max(1, Number(filters.page) || 1); const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const query: any = { companyCode: scope.companyCode, $or: [{ branchId: scope.branchId }, { status: "in_transit", transferToBranchId: scope.branchId }] };
  if (scope.warehouseId) query.$and = [{ warehouseId: scope.warehouseId }];
  if (filters.forSale) query.warehouseId = String((await ensureDefaultWarehouse(scope.companyCode, scope.branchId))._id);
  if (filters.serial) query.normalizedSerialNumber = normalizeSerialNumber(filters.serial);
  if (filters.sku) query.sku = String(filters.sku).trim();
  if (filters.productId) query.productId = String(filters.productId).trim();
  if (filters.variantId) query.variantId = String(filters.variantId).trim();
  if (filters.trackingMode) {
    const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, trackingMode: filters.trackingMode, ...(filters.productId ? { productId: String(filters.productId).trim() } : {}), ...(filters.variantId ? { _id: String(filters.variantId).trim() } : {}), ...(filters.sku ? { sku: String(filters.sku).trim().toUpperCase() } : {}) }).select({ _id: 1 }).lean();
    query.variantId = { $in: variants.map((variant) => String(variant._id)) };
  }
  if (filters.status) query.status = filters.status;
  const [items, total] = await Promise.all([
    SerialUnitModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SerialUnitModel.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function transitionSerialUnit(scope: SerialScope, id: string, input: TransitionSerialInput, actor: SerialActor, session?: ClientSession) {
  const query = SerialUnitModel.findOne({ _id: id, ...scoped(scope) }); if (session) query.session(session);
  const current = await query; if (!current) throw Object.assign(new Error("Không tìm thấy IMEI/serial."), { statusCode: 404 });
  assertSerialTransition(current.status, input.toStatus);
  const fromStatus = current.status;
  current.status = input.toStatus; current.updatedBy = actor.id;
  current.currentDocumentType = input.documentType; current.currentDocumentId = input.documentId;
  if (session) current.$session(session);
  await current.save();
  const event = new SerialEventModel({ ...scoped(scope), serialUnitId: String(current._id), serialNumber: current.serialNumber, eventType: input.eventType, fromStatus, toStatus: input.toStatus, documentType: input.documentType, documentId: input.documentId, reason: input.reason, actorId: actor.id, actorName: actor.name });
  if (session) event.$session(session);
  await event.save();
  return current.toObject();
}

export function getSerialHistory(scope: SerialScope, id: string) { return SerialEventModel.find({ serialUnitId: id, ...scoped(scope) }).sort({ occurredAt: 1 }).lean(); }

export async function transferSerialUnit(scope: SerialScope, id: string, input: TransferSerialInput, actor: SerialActor, session?: ClientSession) {
  const toBranchId = String(input.toBranchId || "").trim();
  if (!toBranchId) throw Object.assign(new Error("Chi nhánh nhận là bắt buộc."), { statusCode: 400 });
  const branchQuery = BranchModel.findOne({ _id: toBranchId, companyCode: scope.companyCode, isActive: true }); if (session) branchQuery.session(session);
  if (!await branchQuery.lean()) throw Object.assign(new Error("Chi nhánh nhận không tồn tại hoặc đã ngừng hoạt động."), { statusCode: 404, code: "BRANCH_NOT_FOUND" });
  const query = SerialUnitModel.findOne({ _id: id, ...scoped(scope), status: "in_stock" }); if (session) query.session(session);
  const current = await query; if (!current) throw Object.assign(new Error("Chỉ được chuyển serial đang ở trạng thái tồn kho."), { statusCode: 409, code: "SERIAL_NOT_TRANSFERABLE" });
  const fromBranchId = current.branchId; current.branchId = toBranchId; current.warehouseId = input.toWarehouseId; current.updatedBy = actor.id;
  if (!current.branchId) throw Object.assign(new Error("Chi nhánh nhận là bắt buộc."), { statusCode: 400 });
  if (session) current.$session(session); await current.save();
  const event = new SerialEventModel({ companyCode: scope.companyCode, branchId: current.branchId, serialUnitId: String(current._id), serialNumber: current.serialNumber, eventType: "transferred", fromStatus: "in_stock", toStatus: "in_stock", documentType: input.documentType || "transfer", documentId: input.documentId, reason: `${fromBranchId} → ${current.branchId}: ${input.reason}`, actorId: actor.id, actorName: actor.name });
  if (session) event.$session(session); await event.save(); return current.toObject();
}
