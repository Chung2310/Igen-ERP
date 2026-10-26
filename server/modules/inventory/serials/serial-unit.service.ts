import type { ClientSession } from "mongoose";
import { randomUUID } from "node:crypto";
import { runInventoryTransaction } from "../../../integrations/shared/inventory-transaction";
import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";
import type { ISerialUnit, SerialUnitStatus } from "./serial-unit.interface";
import { assertSerialTransition, normalizeSerialNumber } from "./serial-state";
import { requestInventoryTransfer, receiveInventoryTransfer } from "../transfers/transfer.service";
import { generateInternalBarcode, normalizeInternalBarcode } from "./unit-barcode-validation";
import { computeWarrantyEnd } from "./warranty-clock";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ensureDefaultWarehouse, getWarehouse } from "../warehouse/warehouse.service";
import { Types } from "mongoose";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";

export interface SerialScope { companyCode: string; branchId: string; warehouseId?: string }
export interface SerialActor { id: string; name: string }
export interface RegisterSerialInput extends Pick<ISerialUnit, "productId" | "sku" | "productName"> { variantId?: string; internalBarcode?: string; serialNumber: string; warehouseId?: string; documentType?: string; documentId?: string; supplierWarranty?: ISerialUnit["supplierWarranty"] }
export interface TransitionSerialInput { toStatus: SerialUnitStatus; eventType: string; reason?: string; documentType?: string; documentId?: string }
export interface TransferSerialInput { toBranchId: string; toWarehouseId?: string; documentType?: string; documentId?: string; reason: string }
export interface RegisterSerialBatchInput extends Omit<RegisterSerialInput, "serialNumber" | "internalBarcode"> { serialNumbers: string[]; internalBarcodes?: string[] }

function scoped(scope: SerialScope) { return { companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}) }; }

export async function registerSerialUnit(scope: SerialScope, input: RegisterSerialInput, actor: SerialActor, session?: ClientSession) {
  if (session) return saveRegisteredSerial(scope, input, actor, session);
  return runInventoryTransaction((transactionSession) => saveRegisteredSerial(scope, input, actor, transactionSession));
}

async function saveRegisteredSerial(scope: SerialScope, input: RegisterSerialInput, actor: SerialActor, session?: ClientSession) {
  if (!scope.companyCode?.trim() || !scope.branchId?.trim()) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
  if (scope.warehouseId && input.warehouseId && scope.warehouseId !== input.warehouseId) throw Object.assign(new Error("Kho đăng ký không khớp phạm vi đã chọn."), { statusCode: 400 });
  const warehouseId = scope.warehouseId || input.warehouseId;
  const warehouse = warehouseId ? await getWarehouse(scope.companyCode, scope.branchId, warehouseId) : await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  if (!warehouse) throw Object.assign(new Error("Kho không thuộc chi nhánh hiện tại."), { statusCode: 400 });
  if (!Types.ObjectId.isValid(input.productId) || (input.variantId && !Types.ObjectId.isValid(input.variantId))) throw Object.assign(new Error("Sản phẩm/SKU đăng ký không hợp lệ."), { statusCode: 400 });
  const variant = await ProductVariantModel.findOne({ companyCode: scope.companyCode, productId: input.productId,
    sku: String(input.sku || "").trim().toUpperCase(), ...(input.variantId ? { _id: input.variantId } : {}),
  }).session(session || null).lean();
  if (!variant || !["serial", "unit_barcode"].includes(variant.trackingMode)) throw Object.assign(new Error("SKU không thuộc sản phẩm/công ty hoặc không quản lý từng đơn vị."), { statusCode: 400 });
  const balanceFilter = { companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id), variantId: String(variant._id) };
  const balance = await InventoryBalanceModel.findOne(balanceFilter).session(session || null).lean();
  const registered = await SerialUnitModel.countDocuments({ ...balanceFilter, status: "in_stock" }).session(session || null);
  if (!balance || registered >= Number(balance.quantity)) throw Object.assign(new Error("Số mã đơn vị vượt tồn kho đã nhập. Hãy xác nhận phiếu nhập kho trước khi đăng ký."), { statusCode: 409, code: "SERIAL_STOCK_NOT_RECEIVED" });
  const locked = await InventoryBalanceModel.updateOne({ _id: balance._id, version: balance.version }, { $inc: { version: 1 } }, { session });
  if (locked.modifiedCount !== 1) throw Object.assign(new Error("Tồn kho vừa thay đổi, vui lòng thử lại."), { statusCode: 409 });
  const normalizedSerialNumber = normalizeSerialNumber(input.serialNumber);
  const internalBarcode = input.internalBarcode || generateInternalBarcode(input.sku, new Date().toISOString().slice(0, 10).replace(/-/g, ""), Date.now() % 1000000);
  const normalizedInternalBarcode = normalizeInternalBarcode(internalBarcode);
  const query = new SerialUnitModel({ ...scoped(scope), warehouseId: String(warehouse._id), productId: input.productId, variantId: String(variant._id),
    sku: variant.sku, productName: input.productName, supplierWarranty: input.supplierWarranty,
    internalBarcode: internalBarcode.trim(), normalizedInternalBarcode, serialNumber: input.serialNumber.trim(), normalizedSerialNumber,
    currentDocumentType: input.documentType, currentDocumentId: input.documentId,
    status: "in_stock", createdBy: actor.id, updatedBy: actor.id });
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
  return runInventoryTransaction(async (transactionSession) => {
    const created: any[] = [];
    for (let i = 0; i < normalized.length; i += 1) created.push(await registerSerialUnit(scope, { ...input, serialNumber: serialNumbers[i], internalBarcode: resolvedBarcodes[i] }, actor, transactionSession));
    return created;
  });
}

export async function listSerialUnits(scope: SerialScope, filters: { serial?: string; barcodes?: string[]; sku?: string; productId?: string; variantId?: string; trackingMode?: "serial" | "unit_barcode"; forSale?: boolean; status?: SerialUnitStatus; page?: number; limit?: number } = {}) {
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
  const selectedBarcodes = (filters.barcodes || []).map(normalizeInternalBarcode).filter(Boolean);
  if (filters.status && selectedBarcodes.length) {
    query.$and = [...(query.$and || []), { $or: [{ status: filters.status }, { normalizedInternalBarcode: { $in: selectedBarcodes } }] }];
  } else if (filters.status) query.status = filters.status;
  else if (selectedBarcodes.length) query.normalizedInternalBarcode = { $in: selectedBarcodes };
  const [items, total] = await Promise.all([
    SerialUnitModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SerialUnitModel.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function transitionSerialUnit(scope: SerialScope, id: string, input: TransitionSerialInput, actor: SerialActor, session?: ClientSession) {
  const operationId = randomUUID();
  if (session) return transitionSerialInSession(scope, id, input, actor, operationId, session);
  return runInventoryTransaction((transactionSession) => transitionSerialInSession(scope, id, input, actor, operationId, transactionSession));
}

async function transitionSerialInSession(scope: SerialScope, id: string, input: TransitionSerialInput, actor: SerialActor, operationId: string, session?: ClientSession) {
  const query = SerialUnitModel.findOne({ _id: id, ...scoped(scope) }); if (session) query.session(session);
  const current = await query; if (!current) throw Object.assign(new Error("Không tìm thấy IMEI/serial."), { statusCode: 404 });
  if ([current.status, input.toStatus].some((status) => ["sold", "returned", "in_transit"].includes(status))) {
    throw Object.assign(new Error("Hãy dùng chứng từ bán/trả hàng hoặc điều chuyển để đổi trạng thái này."), { statusCode: 409 });
  }
  if (!input.reason?.trim()) throw Object.assign(new Error("Lý do thay đổi trạng thái là bắt buộc."), { statusCode: 400 });
  assertSerialTransition(current.status, input.toStatus);
  const fromStatus = current.status;
  if ((fromStatus === "in_stock") !== (input.toStatus === "in_stock")) {
    if (!current.warehouseId) throw Object.assign(new Error("Serial chưa có kho để điều chỉnh tồn."), { statusCode: 409 });
    await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: current.warehouseId,
      direction: input.toStatus === "in_stock" ? "in" : "out", purpose: "other", sourceType: "serial-status-adjustment",
      sourceId: id, idempotencyKey: `serial:${id}:${operationId}`, operatorName: actor.name || actor.id, reason: input.reason, session,
      items: [{ productId: current.productId, variantId: current.variantId, sku: current.sku, productName: current.productName, quantity: 1 }],
    });
  }
  current.status = input.toStatus; current.updatedBy = actor.id;
  current.currentDocumentType = input.documentType; current.currentDocumentId = input.documentId;
  if (session) current.$session(session);
  await current.save();
  const event = new SerialEventModel({ ...scoped(scope), serialUnitId: String(current._id), serialNumber: current.serialNumber, eventType: input.eventType, fromStatus, toStatus: input.toStatus, documentType: input.documentType, documentId: input.documentId, reason: input.reason, actorId: actor.id, actorName: actor.name });
  if (session) event.$session(session);
  await event.save();
  return current.toObject();
}

export async function getSerialUnit(scope: SerialScope, id: string) {
  if (!Types.ObjectId.isValid(id)) throw Object.assign(new Error("Mã đơn vị không hợp lệ."), { statusCode: 400 });
  const unit = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode,
    $or: [{ branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}) },
      { status: "in_transit", transferToBranchId: scope.branchId, ...(scope.warehouseId ? { transferToWarehouseId: scope.warehouseId } : {}) }],
  }).lean();
  if (!unit) throw Object.assign(new Error("Không tìm thấy IMEI/serial trong chi nhánh."), { statusCode: 404 });
  return unit;
}

export async function getSerialHistory(scope: SerialScope, id: string) {
  await getSerialUnit(scope, id);
  return SerialEventModel.find({ serialUnitId: id, companyCode: scope.companyCode }).sort({ occurredAt: 1 }).lean();
}

export async function transferSerialUnit(scope: SerialScope, id: string, input: TransferSerialInput, actor: SerialActor, session?: ClientSession) {
  if (session) throw Object.assign(new Error("Điều chuyển tức thời không hỗ trợ giao dịch bên ngoài."), { statusCode: 400 });
  const toBranchId = String(input.toBranchId || "").trim();
  if (!toBranchId || !input.reason?.trim()) throw Object.assign(new Error("Chi nhánh nhận và lý do điều chuyển là bắt buộc."), { statusCode: 400 });
  if (toBranchId !== scope.branchId) throw Object.assign(new Error("Điều chuyển khác chi nhánh phải tạo yêu cầu và được kho nhận xác nhận."), { statusCode: 409, code: "SERIAL_TRANSFER_RECEIPT_REQUIRED" });
  const unit = await SerialUnitModel.findOne({ _id: id, ...scoped(scope), status: "in_stock" }).lean();
  if (!unit?.variantId || !unit.warehouseId) throw Object.assign(new Error("IMEI chưa gắn SKU và kho hợp lệ để điều chuyển."), { statusCode: 409 });
  const toWarehouseId = input.toWarehouseId || String((await ensureDefaultWarehouse(scope.companyCode, toBranchId))?._id || "");
  const transfer = await requestInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, {
    idempotencyKey: randomUUID(),
    fromWarehouseId: unit.warehouseId, toWarehouseId, toBranchId, reason: input.reason.trim(),
    items: [{ variantId: unit.variantId, quantity: 1, serialNumbers: [unit.serialNumber] }],
  }, actor);
  await receiveInventoryTransfer({ companyCode: scope.companyCode, branchId: toBranchId }, String(transfer._id), actor);
  return SerialUnitModel.findById(id).lean();
}
