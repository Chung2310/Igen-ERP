import { createHash } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { StockLogModel } from "../../model/stock-log.model";
import { ProductModel } from "../../model/product.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";
import { inInventoryTransaction } from "./inventory-transaction";
import { inventoryError, resolveInventoryVariant, resolveInventoryWarehouse, type InventoryScope } from "./inventory-scope";

const completed = (status: string) => ["Hoàn thành", "Thành công"].includes(status);
export type InventoryActor = { id: string; name: string };
const editableFields = ["type", "purpose", "title", "operatorName", "notes", "status", "items", "warehouseId", "customerId", "customerName"] as const;
function payload(input: any) {
  return Object.fromEntries(editableFields.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}
function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const fingerprint = (input: any) => createHash("sha256").update(JSON.stringify(stable(payload(input)))).digest("hex");

async function prepare(scope: InventoryScope, input: any, session: ClientSession) {
  if (!["nhập", "xuất"].includes(input.type)) inventoryError("Loại phiếu kho không hợp lệ.");
  if (!["Đang chờ", "Đang xử lý", "Hoàn thành", "Thành công"].includes(input.status)) inventoryError("Trạng thái phiếu kho không hợp lệ.");
  if (input.type === "xuất" && !["bán", "nội bộ", "hủy", "chuyển kho"].includes(input.purpose)) inventoryError("Phiếu xuất phải có mục đích hợp lệ.");
  if (!Array.isArray(input.items) || !input.items.length) inventoryError("Phiếu kho phải có ít nhất một dòng hàng.");
  const warehouse = await resolveInventoryWarehouse(scope, input.warehouseId, session);
  const items: any[] = [];
  for (const raw of input.items) {
    const quantity = Number(raw?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) inventoryError("Số lượng phải lớn hơn 0.");
    if (!Types.ObjectId.isValid(String(raw?.productId || ""))) inventoryError("Sản phẩm không hợp lệ.");
    const legacy = !raw.variantId ? await ProductModel.findOne({ _id: raw.productId, companyCode: scope.companyCode, branchId: scope.branchId }).session(session).lean() : null;
    const resolved = legacy ? null : await resolveInventoryVariant(scope.companyCode, raw, session);
    const variant = resolved?.variant;
    if (legacy && String(raw.sku || "").trim().toUpperCase() !== legacy.sku) inventoryError("SKU không khớp sản phẩm.");
    const trackingMode = variant?.trackingMode || "quantity";
    const unitPrice = Number(raw.unitPrice ?? legacy?.price ?? 0);
    const unitCost = Number(raw.unitCost ?? legacy?.costPrice ?? 0);
    if (![unitPrice, unitCost].every((value) => Number.isFinite(value) && value >= 0)) inventoryError("Giá hàng không hợp lệ.");
    const identifiers = (Array.isArray(raw.unitIdentifiers) && raw.unitIdentifiers.length ? raw.unitIdentifiers : raw.serialNumbers || []).map((value: unknown) => String(value).trim().toUpperCase());
    if (["serial", "unit_barcode"].includes(trackingMode)) {
      if (!Number.isInteger(quantity) || identifiers.length !== quantity || identifiers.some((id: string) => !id) || new Set(identifiers).size !== identifiers.length) inventoryError("Số mã máy duy nhất phải bằng số lượng xuất.");
      if (input.type === "nhập") inventoryError("Hàng theo từng máy phải nhập qua phiếu nhập hàng hoặc chứng từ hoàn trả.");
    } else if (identifiers.length) inventoryError("SKU này không theo dõi từng máy.");
    items.push({ productId: String(raw.productId), ...(variant ? { variantId: String(variant._id) } : { legacyProductId: String(legacy!._id) }), sku: variant?.sku || legacy!.sku, productName: resolved?.product.name || legacy!.name, quantity, unitPrice, unitCost, lineTotal: unitPrice * quantity, unitIdentifiers: identifiers, serialNumbers: Array.isArray(raw.serialNumbers) ? raw.serialNumbers : [], trackingMode });
  }
  return { ...payload(input), ...scope, warehouseId: String(warehouse._id), items, quantity: items.reduce((sum, item) => sum + item.quantity, 0), sku: items[0].sku, productName: items[0].productName };
}

async function post(scope: InventoryScope, log: any, items: any[], session: ClientSession, actor?: InventoryActor) {
  if (log.type === "xuất" && log.purpose === "chuyển kho") inventoryError("Hãy dùng quy trình điều chuyển để ghi nhận cả kho gửi và kho nhận.");
  const internal = log.type === "xuất" && log.purpose === "nội bộ";
  if (internal && (!String(log.customerName || "").trim() || !String(log.notes || "").trim())) inventoryError("Xuất nội bộ cần tên người/phòng ban nhận và lý do cấp phát.");
  if (internal && (!actor?.id?.trim() || !actor?.name?.trim())) inventoryError("Xuất nội bộ cần tác nhân xác thực.", 403);
  const units: any[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!["serial", "unit_barcode"].includes(item.trackingMode)) continue;
    for (const identifier of item.unitIdentifiers) {
      const matches = await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: log.warehouseId, productId: item.productId, variantId: item.variantId, status: "in_stock", $or: [{ normalizedSerialNumber: identifier }, { normalizedInternalBarcode: identifier }, { normalizedBarcodeAliases: identifier }] }).session(session);
      if (matches.length !== 1 || seen.has(String(matches[0]._id))) inventoryError(`Mã ${identifier} không sẵn sàng, bị trùng hoặc không thuộc SKU/kho xuất.`, 409);
      seen.add(String(matches[0]._id)); units.push(matches[0]);
    }
  }
  const movement = await writeStockMovement({ ...scope, warehouseId: log.warehouseId, direction: log.type === "nhập" ? "in" : "out", purpose: log.type === "nhập" ? "other" : log.purpose === "bán" ? "sale" : log.purpose === "hủy" ? "cancel" : "other", sourceType: "manual-stock-log", sourceId: String(log._id), sourceCode: log.title, idempotencyKey: `manual-stock-log:${log._id}:post`, operatorName: log.operatorName, reason: log.notes, items, session, writeLegacyStockLog: false });
  const toStatus = internal ? "internal_use" : log.purpose === "hủy" ? "scrapped" : "sold";
  log.postedById = actor?.id;
  log.postedByName = actor?.name;
  log.postedAt = new Date();
  for (const unit of units) {
    const costIndex = items.findIndex((item) => item.variantId === unit.variantId && item.productId === unit.productId);
    const result = await SerialUnitModel.updateOne({ _id: unit._id, companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: log.warehouseId, status: "in_stock" }, { $set: { status: toStatus, currentDocumentType: "manual-stock-log", currentDocumentId: String(log._id), updatedBy: actor?.id || log.operatorName, ...(internal ? { internalUse: { recipientName: String(log.customerName).trim(), issuedAt: log.postedAt, stockLogId: String(log._id), unitCost: movement.entries[costIndex].unitCost } } : {}) } }, { session });
    if (result.modifiedCount !== 1) inventoryError("Trạng thái máy vừa thay đổi. Vui lòng tải lại.", 409);
    await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: toStatus, fromStatus: "in_stock", toStatus, documentType: "manual-stock-log", documentId: String(log._id), actorId: actor?.id || "SYSTEM", actorName: actor?.name || log.operatorName, reason: internal ? `${log.notes} — Người nhận: ${String(log.customerName).trim()}` : log.notes }], { session });
  }
  // Snapshot the actual posted costs, including the moving average for outbound.
  log.items = items.map((item, index) => ({ ...item, unitCost: movement.entries[index].unitCost }));
}

export async function createManualStockLog(scope: InventoryScope, input: any, actor?: InventoryActor) {
  const requestKey = String(input.idempotencyKey || "").trim();
  if (requestKey.length > 160) inventoryError("Khóa yêu cầu quá dài.");
  const requestFingerprint = fingerprint(input);
  const replay = (existing: any) => {
    if (existing.branchId !== scope.branchId || existing.requestFingerprint !== requestFingerprint) inventoryError("Khóa yêu cầu đã dùng cho nội dung khác.", 409);
    return existing.toObject();
  };
  try {
    return await inInventoryTransaction(async (session) => {
      if (requestKey) {
        const existing = await StockLogModel.findOne({ companyCode: scope.companyCode, idempotencyKey: `manual-create:${requestKey}` }).session(session);
        if (existing) return replay(existing);
      }
      const prepared = await prepare(scope, { ...input, status: input.status || "Đang chờ" }, session);
      const log = new StockLogModel({ ...prepared, ...(actor ? { createdById: actor.id } : {}), ...(requestKey ? { idempotencyKey: `manual-create:${requestKey}`, requestFingerprint } : {}) });
      await log.validate();
      if (completed(log.status)) await post(scope, log, prepared.items, session, actor);
      await log.save({ session });
      return log.toObject();
    });
  } catch (error: any) {
    // A duplicate aborts the transaction. Resolve a concurrent create only after
    // it has ended, and only for this document's idempotency index.
    if (requestKey && error?.code === 11000 && error?.keyPattern?.idempotencyKey) {
      const existing = await StockLogModel.findOne({ companyCode: scope.companyCode, idempotencyKey: `manual-create:${requestKey}` });
      if (existing) return replay(existing);
    }
    throw error;
  }
}

export async function updateManualStockLog(scope: InventoryScope, id: string, input: any, actor?: InventoryActor) {
  return inInventoryTransaction(async (session) => {
    const log = await StockLogModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId }).session(session);
    if (!log) inventoryError("Không tìm thấy phiếu kho.", 404);
    if (completed(log.status) && completed(input.status) && log.postingFingerprint === fingerprint(input)) return log.toObject();
    if (completed(log.status) || await InventoryLedgerEntryModel.exists({ companyCode: scope.companyCode, sourceId: id }).session(session)) inventoryError("Phiếu đã ghi sổ không được sửa. Hãy lập chứng từ điều chỉnh.", 409);
    const updates = payload(input);
    // A quick status update uses the warehouse and items saved on the document.
    const prepared = await prepare(scope, { ...log.toObject(), ...updates }, session);
    log.set(prepared);
    await log.validate();
    if (completed(log.status)) {
      log.postingFingerprint = fingerprint(input);
      await post(scope, log, prepared.items, session, actor);
    }
    await log.save({ session });
    return log.toObject();
  });
}

export async function deleteManualStockLog(scope: InventoryScope, id: string) {
  return inInventoryTransaction(async (session) => {
    const log = await StockLogModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId }).session(session);
    if (!log) inventoryError("Không tìm thấy phiếu kho.", 404);
    if (completed(log.status) || await InventoryLedgerEntryModel.exists({ companyCode: scope.companyCode, sourceId: id }).session(session)) inventoryError("Không được xóa phiếu đã ghi sổ.", 409);
    await log.deleteOne({ session });
    return log.toObject();
  });
}
