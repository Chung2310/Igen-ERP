import type { ClientSession } from "mongoose";
import { inInventoryTransaction } from "../inventory-transaction";
import { rejectScopeOverrides, resolveInventoryVariant, resolveInventoryWarehouse, inventoryError } from "../inventory-scope";
import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";
import type { ISerialUnit, SerialUnitStatus } from "./serial-unit.interface";
import { normalizeSerialNumber } from "./serial-state";
import { normalizeInternalBarcode } from "./unit-barcode-validation";
import { allocateInternalBarcodes } from "./unit-barcode-allocator";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ensureDefaultWarehouse } from "../warehouse/warehouse.service";
import { InventoryTransferModel } from "../transfers/transfer.model";

export interface SerialScope { companyCode: string; branchId: string; warehouseId?: string }
export interface SerialActor { id: string; name: string }
export interface RegisterSerialInput extends Pick<ISerialUnit, "productId" | "sku" | "productName"> { variantId?: string; internalBarcode?: string; serialNumber: string; imei1?: string; imei2?: string; warehouseId?: string; documentType?: string; documentId?: string; supplierWarranty?: ISerialUnit["supplierWarranty"] }
export interface TransitionSerialInput { toStatus: SerialUnitStatus; eventType: string; reason?: string; documentType?: string; documentId?: string }
export interface TransferSerialInput { toBranchId: string; toWarehouseId?: string; documentType?: string; documentId?: string; reason: string }
export interface RegisterSerialBatchInput extends Omit<RegisterSerialInput, "serialNumber" | "internalBarcode" | "imei1" | "imei2"> { serialNumbers?: string[]; quantity?: number; unitDetails?: Array<{ internalBarcode?: string; serialNumber?: string; imei1?: string; imei2?: string }> }

function scoped(scope: SerialScope) { return { companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}) }; }

export async function registerSerialUnit(scope: SerialScope, input: RegisterSerialInput, actor: SerialActor, session?: ClientSession) {
  rejectScopeOverrides(input);
  if (!session) return inInventoryTransaction((transaction) => registerSerialUnit(scope, input, actor, transaction));
  if (!session.inTransaction()) inventoryError("Đăng ký máy yêu cầu transaction.", 503);
  const warehouse = await resolveInventoryWarehouse(scope, input.warehouseId, session);
  const { product, variant } = await resolveInventoryVariant(scope.companyCode, input, session);
  if (!["serial", "unit_barcode"].includes(variant.trackingMode)) inventoryError("SKU không theo dõi từng máy.");
  const normalizedSerialNumber = normalizeSerialNumber(input.serialNumber);
  const internalBarcode = input.internalBarcode || (await allocateInternalBarcodes(1))[0];
  const normalizedInternalBarcode = normalizeInternalBarcode(internalBarcode);
  const serialNumber = input.serialNumber.trim();
  const imei1 = String(input.imei1 || "").trim();
  const imei2 = String(input.imei2 || "").trim();
  if (imei1 && imei2 && imei1.toUpperCase() === imei2.toUpperCase()) inventoryError("IMEI 1 và IMEI 2 không được trùng nhau.");
  const normalizedImeis = [...new Set([imei1, imei2].filter(Boolean).map((value) => value.toUpperCase()))];
  // Write the shared balance before counting units. Concurrent registrations and
  // stock movements must conflict/retry on the same document, not both claim
  // the last unassigned quantity from independent snapshot reads.
  const balanceScope = { companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id), productId: String(product._id), variantId: String(variant._id) };
  const balance = await InventoryBalanceModel.findOneAndUpdate(
    { ...balanceScope, sku: variant.sku }, { $inc: { version: 1 } },
    { session, returnDocument: "after" },
  ).lean();
  if (!balance || !Number.isSafeInteger(balance.quantity) || balance.quantity <= 0) {
    inventoryError("Kho chưa có tồn nguyên dương cho SKU này. Hãy nhập hàng bằng phiếu nhập trước khi bổ sung mã máy.", 409);
  }
  const assigned = await SerialUnitModel.countDocuments({
    companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(warehouse._id), productId: String(product._id), status: "in_stock",
    $or: [{ variantId: String(variant._id) }, { variantId: null, sku: variant.sku }],
  }).session(session);
  if (assigned >= balance.quantity) inventoryError("Số tồn của SKU tại kho đã được gắn đủ mã máy. Không thể đăng ký thêm; hãy đối soát hoặc nhập hàng bằng chứng từ.", 409);
  const query = new SerialUnitModel({ ...scoped(scope), warehouseId: String(warehouse._id), productId: String(product._id), variantId: String(variant._id), sku: variant.sku, productName: product.name, supplierWarranty: input.supplierWarranty, currentDocumentType: input.documentType, currentDocumentId: input.documentId, internalBarcode: internalBarcode.trim(), normalizedInternalBarcode, globalBarcodeKey: normalizedInternalBarcode, serialNumber, normalizedSerialNumber, ...(imei1 ? { imei1 } : {}), ...(imei2 ? { imei2 } : {}), ...(normalizedImeis.length ? { normalizedImeis } : {}), status: "in_stock", createdBy: actor.id, updatedBy: actor.id });
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
  rejectScopeOverrides(input);
  const serialNumbers = Array.isArray(input.serialNumbers) ? input.serialNumbers : [];
  const unitDetails = Array.isArray(input.unitDetails) ? input.unitDetails : [];
  const variant = input.variantId
    ? await ProductVariantModel.findOne({ _id: input.variantId, companyCode: scope.companyCode, productId: input.productId }).select("trackingMode").lean()
    : null;
  if (!variant) throw Object.assign(new Error("Không tìm thấy SKU để đăng ký máy."), { statusCode: 404 });
  const isUnitBarcode = variant.trackingMode === "unit_barcode";
  const quantity = isUnitBarcode ? Number(input.quantity ?? unitDetails.length) : serialNumbers.length;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) throw Object.assign(new Error("Số máy cần đăng ký phải là số nguyên từ 1 đến 500."), { statusCode: 400 });
  if (!isUnitBarcode && serialNumbers.length !== quantity) throw Object.assign(new Error("Số serial phải bằng số lượng đơn vị."), { statusCode: 400 });
  if (isUnitBarcode && unitDetails.length !== quantity) throw Object.assign(new Error("Danh sách thông tin máy phải bằng số lượng đơn vị."), { statusCode: 400 });
  if (unitDetails.length && unitDetails.length !== quantity) throw Object.assign(new Error("Danh sách thông tin máy phải bằng số lượng đơn vị."), { statusCode: 400 });
  const requestedBarcodes = Array.from({ length: quantity }, (_, index) => String(unitDetails[index]?.internalBarcode || "").trim());
  const missingBarcodeCount = requestedBarcodes.filter((barcode) => !barcode).length;
  const newlyAllocatedBarcodes = missingBarcodeCount > 0 ? await allocateInternalBarcodes(missingBarcodeCount) : [];
  let nextAllocatedBarcode = 0;
  const resolvedBarcodes = requestedBarcodes.map((barcode) => barcode || newlyAllocatedBarcodes[nextAllocatedBarcode++]);
  const serialIdentifiers = Array.from({ length: quantity }, (_, index) => unitDetails[index]?.serialNumber?.trim() || serialNumbers[index]?.trim() || resolvedBarcodes[index]);
  const normalized = serialIdentifiers.map(normalizeSerialNumber);
  if (new Set(normalized).size !== normalized.length) throw Object.assign(new Error("Danh sách serial bị trùng."), { statusCode: 400 });
  const normalizedBarcodes = resolvedBarcodes.map(normalizeInternalBarcode);
  const enteredIdentifiers = unitDetails.flatMap((unit, index) => [unit.serialNumber || serialNumbers[index], unit.imei1, unit.imei2].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean));
  if (enteredIdentifiers.some((identifier) => normalizedBarcodes.includes(identifier))) throw Object.assign(new Error("Mã quản lý không được trùng với serial hoặc IMEI."), { statusCode: 400 });
  const existingIdentifierCollision = await SerialUnitModel.exists({
    $or: [
      { normalizedInternalBarcode: { $in: normalizedBarcodes } },
      { normalizedBarcodeAliases: { $in: normalizedBarcodes } },
      { normalizedSerialNumber: { $in: normalizedBarcodes } },
      { normalizedImeis: { $in: normalizedBarcodes } },
    ],
  });
  if (existingIdentifierCollision) throw Object.assign(new Error("Mã quản lý đã được dùng cho mã vạch, serial hoặc IMEI. Vui lòng sinh mã khác."), { statusCode: 409, code: "UNIT_ID_DUPLICATE" });
  if (new Set(normalizedBarcodes).size !== normalizedBarcodes.length) throw Object.assign(new Error("Danh sách mã vạch nội bộ bị trùng."), { statusCode: 400 });
  const allImeis = unitDetails.flatMap((unit) => [unit.imei1, unit.imei2].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean));
  if (new Set(allImeis).size !== allImeis.length) throw Object.assign(new Error("IMEI trong danh sách máy bị trùng."), { statusCode: 400 });
  if (session) {
    const created: any[] = [];
    for (let i = 0; i < quantity; i += 1) created.push(await registerSerialUnit(scope, { ...input, serialNumber: serialIdentifiers[i], imei1: unitDetails[i]?.imei1, imei2: unitDetails[i]?.imei2, internalBarcode: resolvedBarcodes[i] }, actor, session));
    return created;
  }
  return inInventoryTransaction(async (transactionSession) => {
    const created: any[] = [];
    for (let i = 0; i < quantity; i += 1) created.push(await registerSerialUnit(scope, { ...input, serialNumber: serialIdentifiers[i], imei1: unitDetails[i]?.imei1, imei2: unitDetails[i]?.imei2, internalBarcode: resolvedBarcodes[i] }, actor, transactionSession));
    return created;
  });
}

export async function listSerialUnits(scope: SerialScope, filters: { serial?: string; barcodes?: string[]; sku?: string; productId?: string; variantId?: string; trackingMode?: "serial" | "unit_barcode"; forSale?: boolean; status?: SerialUnitStatus; page?: number; limit?: number } = {}) {
  const page = Math.max(1, Number(filters.page) || 1); const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const query: any = { companyCode: scope.companyCode, $or: [{ branchId: scope.branchId }, { status: "in_transit", transferToBranchId: scope.branchId }] };
  if (scope.warehouseId) {
    const outgoing = await InventoryTransferModel.find({ companyCode: scope.companyCode, fromBranchId: scope.branchId, fromWarehouseId: scope.warehouseId, status: "in_transit" }).select("_id").lean();
    query.$and = [{ $or: [{ warehouseId: scope.warehouseId }, { status: "in_transit", transferToWarehouseId: scope.warehouseId }, { status: "in_transit", currentDocumentType: "inventory-transfer", currentDocumentId: { $in: outgoing.map((doc) => String(doc._id)) } }] }];
  }
  if (filters.forSale) query.warehouseId = String((await ensureDefaultWarehouse(scope.companyCode, scope.branchId))._id);
  if (filters.serial) {
    const identifier = normalizeSerialNumber(filters.serial);
    query.$and = [...(query.$and || []), { $or: [{ normalizedSerialNumber: identifier }, { normalizedInternalBarcode: identifier }, { normalizedBarcodeAliases: identifier }, { normalizedImeis: identifier }] }];
  }
  if (filters.sku) query.sku = String(filters.sku).trim();
  if (filters.productId) query.productId = String(filters.productId).trim();
  if (filters.variantId) query.variantId = String(filters.variantId).trim();
  if (filters.trackingMode) {
    const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, trackingMode: filters.trackingMode, ...(filters.productId ? { productId: String(filters.productId).trim() } : {}), ...(filters.variantId ? { _id: String(filters.variantId).trim() } : {}), ...(filters.sku ? { sku: String(filters.sku).trim().toUpperCase() } : {}) }).select({ _id: 1 }).lean();
    query.variantId = { $in: variants.map((variant) => String(variant._id)) };
  }
  const selectedBarcodes = (filters.barcodes || []).map(normalizeInternalBarcode).filter(Boolean);
  if (filters.status && selectedBarcodes.length) {
    query.$and = [...(query.$and || []), { $or: [{ status: filters.status }, { normalizedInternalBarcode: { $in: selectedBarcodes } }, { normalizedBarcodeAliases: { $in: selectedBarcodes } }] }];
  } else if (filters.status) query.status = filters.status;
  else if (selectedBarcodes.length) query.$and = [...(query.$and || []), { $or: [{ normalizedInternalBarcode: { $in: selectedBarcodes } }, { normalizedBarcodeAliases: { $in: selectedBarcodes } }] }];
  if (filters.forSale) query.$and = [...(query.$and || []), { status: { $ne: "internal_use" } }];
  const [items, total] = await Promise.all([
    SerialUnitModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SerialUnitModel.countDocuments(query),
  ]);
  return { items, total, page, limit };
}

export async function transitionSerialUnit(scope: SerialScope, id: string, input: TransitionSerialInput, actor: SerialActor, session?: ClientSession) {
  const query = SerialUnitModel.exists({ _id: id, ...scoped(scope) });
  if (session) query.session(session);
  if (!await query) throw Object.assign(new Error("Không tìm thấy IMEI/serial."), { statusCode: 404 });
  // A caller-supplied document ID is not evidence of a posted stock or repair
  // operation. Only the owning workflow may update units and its ledger/events.
  throw Object.assign(new Error("Đổi trạng thái trực tiếp đã ngừng hỗ trợ. Hãy xử lý qua chứng từ bán hàng, phiếu kho, kiểm kê, điều chuyển hoặc phiếu sửa chữa tương ứng."), { statusCode: 409, code: "SERIAL_WORKFLOW_REQUIRED" });
}

export async function getSerialHistory(scope: SerialScope, id: string) {
  const accessible = await SerialUnitModel.exists({ _id: id, companyCode: scope.companyCode, $or: [{ branchId: scope.branchId }, { transferToBranchId: scope.branchId }] });
  const participated = accessible || await InventoryTransferModel.exists({ companyCode: scope.companyCode, "items.serialUnitIds": id, $or: [{ fromBranchId: scope.branchId }, { toBranchId: scope.branchId }] });
  if (!participated) inventoryError("Không tìm thấy máy trong phạm vi chi nhánh.", 404);
  return SerialEventModel.find({ serialUnitId: id, companyCode: scope.companyCode }).sort({ occurredAt: 1 }).lean();
}

export async function transferSerialUnit(_scope: SerialScope, _id: string, _input: TransferSerialInput, _actor: SerialActor, _session?: ClientSession) {
  throw Object.assign(new Error("Chuyển trực tiếp đã ngừng hỗ trợ. Hãy lập yêu cầu điều chuyển và xác nhận tại chi nhánh nhận."), { statusCode: 409, code: "TRANSFER_WORKFLOW_REQUIRED" });
}
