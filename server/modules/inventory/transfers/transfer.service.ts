import { createHash } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { InventoryTransferModel } from "./transfer.model";
import { inInventoryTransaction } from "../inventory-transaction";
import { inventoryError, rejectScopeOverrides, resolveInventoryVariant, resolveInventoryWarehouse, type InventoryScope } from "../inventory-scope";
import { WarehouseModel } from "../../../model/warehouse.model";
import { BranchModel } from "../../../model/branch.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { SerialEventModel } from "../serials/serial-event.model";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { ensureDefaultWarehouse } from "../warehouse/warehouse.service";

export type TransferActor = { id: string; name: string };
// Existing ERP transfers keep their recorded stock legs; only project missing
// display metadata into the Retail contract, without rewriting historical stock.
async function transferViews<T extends { fromWarehouseId: string; toWarehouseId: string; transferCode?: string; code?: string; createdByName?: string; createdBy?: string; fromWarehouseName?: string; toWarehouseName?: string }>(companyCode: string, documents: T[]) {
  const ids = [...new Set(documents.flatMap((document) => [document.fromWarehouseId, document.toWarehouseId]))];
  const warehouses = await WarehouseModel.find({ companyCode, _id: { $in: ids } }).select("name").lean();
  const names = new Map(warehouses.map((warehouse) => [String(warehouse._id), warehouse.name]));
  return documents.map((document) => ({ ...document, transferCode: document.transferCode || document.code || "", fromWarehouseName: document.fromWarehouseName || names.get(document.fromWarehouseId) || document.fromWarehouseId, toWarehouseName: document.toWarehouseName || names.get(document.toWarehouseId) || document.toWarehouseId, createdByName: document.createdByName || document.createdBy || "" }));
}
export type TransferInput = {
  fromWarehouseId: string; toBranchId: string; toWarehouseId?: string; reason: string; idempotencyKey: string;
  items: Array<{ productId: string; variantId: string; sku?: string; quantity: number; unitIdentifiers?: string[] }>;
};
const text = (value: unknown) => String(value || "").trim();
const scoped = (scope: InventoryScope) => ({ companyCode: scope.companyCode, $or: [{ fromBranchId: scope.branchId }, { toBranchId: scope.branchId }] });
function actorRequired(actor: TransferActor) { if (!text(actor.id) || !text(actor.name)) inventoryError("Thiếu người thực hiện điều chuyển."); }
function normalize(input: TransferInput) {
  rejectScopeOverrides(input);
  const result = { fromWarehouseId: text(input.fromWarehouseId), toBranchId: text(input.toBranchId), toWarehouseId: text(input.toWarehouseId), reason: text(input.reason), idempotencyKey: text(input.idempotencyKey), items: Array.isArray(input.items) ? input.items.map((item) => ({ productId: text(item?.productId), variantId: text(item?.variantId), sku: text(item?.sku).toUpperCase(), quantity: Number(item?.quantity), unitIdentifiers: Array.isArray(item?.unitIdentifiers) ? item.unitIdentifiers.map((code) => text(code).toUpperCase()).sort() : [] })) : [] };
  if (!result.reason || !result.idempotencyKey || result.idempotencyKey.length > 160) inventoryError("Lý do và khóa yêu cầu điều chuyển là bắt buộc.");
  if (!Types.ObjectId.isValid(result.fromWarehouseId) || !Types.ObjectId.isValid(result.toBranchId) || (result.toWarehouseId && !Types.ObjectId.isValid(result.toWarehouseId))) inventoryError("Kho hoặc chi nhánh điều chuyển không hợp lệ.");
  if (!result.items.length || result.items.length > 100) inventoryError("Phiếu điều chuyển cần từ 1 đến 100 dòng SKU.");
  const variants = new Set<string>();
  for (const item of result.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || variants.has(item.variantId)) inventoryError("Số lượng phải dương và mỗi SKU chỉ xuất hiện một lần.");
    variants.add(item.variantId);
  }
  return result;
}

async function events(document: any, actor: TransferActor, eventType: string, fromStatus: string, toStatus: string, branchId: string, session: ClientSession, reason?: string) {
  for (const item of document.items) for (const serialUnitId of item.serialUnitIds) {
    const unit = await SerialUnitModel.findOne({ _id: serialUnitId, companyCode: document.companyCode }).session(session);
    await SerialEventModel.create([{ companyCode: document.companyCode, branchId, serialUnitId, serialNumber: unit!.serialNumber, eventType, fromStatus, toStatus, documentType: "inventory-transfer", documentId: String(document._id), reason: reason || document.reason, actorId: actor.id, actorName: actor.name }], { session });
  }
}

export async function createTransfer(scope: InventoryScope, raw: TransferInput, actor: TransferActor) {
  actorRequired(actor);
  const input = normalize(raw);
  if (scope.warehouseId && input.fromWarehouseId !== scope.warehouseId) inventoryError("Kho gửi không thuộc phạm vi đang thao tác.", 403);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const replay = (doc: any) => {
    if (doc.fromBranchId !== scope.branchId || doc.requestFingerprint !== fingerprint) inventoryError("Khóa điều chuyển đã được dùng cho nội dung khác.", 409);
    return doc.toObject();
  };
  try {
    return await inInventoryTransaction(async (session) => {
      const existing = await InventoryTransferModel.findOne({ companyCode: scope.companyCode, requestKey: input.idempotencyKey }).session(session);
      if (existing) return replay(existing);
      const source = await resolveInventoryWarehouse(scope, input.fromWarehouseId, session);
      const target = await resolveInventoryWarehouse({ companyCode: scope.companyCode, branchId: input.toBranchId }, input.toWarehouseId, session);
      if (String(source._id) === String(target._id)) inventoryError("Kho gửi và kho nhận phải khác nhau.");
      const items: any[] = [], seenUnits = new Set<string>();
      for (const line of input.items) {
        const { product, variant } = await resolveInventoryVariant(scope.companyCode, line, session);
        if (variant.trackingMode === "lot") inventoryError("Điều chuyển hàng theo lô cần quy trình định danh lô; chưa hỗ trợ trên phiếu này.");
        const serialUnitIds: string[] = [];
        if (["serial", "unit_barcode"].includes(variant.trackingMode)) {
          if (!Number.isInteger(line.quantity) || line.quantity > 500 || line.unitIdentifiers.length !== line.quantity) inventoryError("Số mã máy phải bằng số lượng nguyên, tối đa 500 máy mỗi dòng.");
          for (const identifier of line.unitIdentifiers) {
            const matches = await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(source._id), productId: line.productId, variantId: line.variantId, status: "in_stock", $or: [{ normalizedSerialNumber: identifier }, { normalizedInternalBarcode: identifier }, { normalizedBarcodeAliases: identifier }] }).session(session).lean();
            if (!identifier || matches.length !== 1 || seenUnits.has(String(matches[0]._id))) inventoryError(`Mã ${identifier} không thuộc SKU/kho gửi, không còn tồn hoặc đã bị chọn lặp.`, 409);
            const id = String(matches[0]._id); seenUnits.add(id); serialUnitIds.push(id);
          }
        } else if (line.unitIdentifiers.length) inventoryError("Hàng số lượng không nhận danh sách mã máy.");
        items.push({ productId: String(product._id), variantId: String(variant._id), sku: variant.sku, productName: product.name, trackingMode: variant.trackingMode, quantity: line.quantity, unitCost: 0, unitIdentifiers: line.unitIdentifiers, serialUnitIds });
      }
      const documentId = new Types.ObjectId();
      const transitId = new Types.ObjectId();
      const transferCode = `CK-${String(documentId).toUpperCase()}`;
      // One transit location per shipment keeps its historical cost isolated from
      // other shipments of the same SKU at a different cost.
      await WarehouseModel.create([{ _id: transitId, companyCode: scope.companyCode, branchId: scope.branchId, code: transferCode, name: `Đang vận chuyển ${transferCode}`, kind: "transit", isDefault: false, isActive: true }], { session });
      const movement = await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(source._id), direction: "out", purpose: "transfer", sourceType: "inventory-transfer", sourceId: String(documentId), sourceCode: transferCode, idempotencyKey: `transfer:${documentId}:send:out`, operatorName: actor.name, items, reason: input.reason, session, writeLegacyStockLog: false });
      items.forEach((item, index) => { item.unitCost = movement.entries[index].unitCost; });
      await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(transitId), direction: "in", purpose: "transfer", sourceType: "inventory-transfer", sourceId: String(documentId), sourceCode: transferCode, idempotencyKey: `transfer:${documentId}:send:in`, operatorName: actor.name, items, reason: input.reason, session, writeLegacyStockLog: false });
      const [doc] = await InventoryTransferModel.create([{ _id: documentId, companyCode: scope.companyCode, transferCode, code: transferCode, idempotencyKey: input.idempotencyKey, fromBranchId: scope.branchId, fromWarehouseId: String(source._id), fromWarehouseName: source.name, toBranchId: input.toBranchId, toWarehouseId: String(target._id), toWarehouseName: target.name, transitWarehouseId: String(transitId), status: "in_transit", items, reason: input.reason, requestKey: input.idempotencyKey, requestFingerprint: fingerprint, createdBy: actor.id, createdByName: actor.name }], { session });
      for (const serialUnitId of seenUnits) {
        const changed = await SerialUnitModel.updateOne({ _id: serialUnitId, companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(source._id), status: "in_stock" }, { $set: { warehouseId: String(transitId), status: "in_transit", transferToBranchId: input.toBranchId, transferToWarehouseId: String(target._id), currentDocumentType: "inventory-transfer", currentDocumentId: String(documentId), updatedBy: actor.id } }, { session });
        if (changed.modifiedCount !== 1) inventoryError("Máy vừa thay đổi trạng thái. Vui lòng tải lại.", 409);
      }
      await events(doc, actor, "transfer_requested", "in_stock", "in_transit", scope.branchId, session);
      return doc.toObject();
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.requestKey) {
      const existing = await InventoryTransferModel.findOne({ companyCode: scope.companyCode, requestKey: input.idempotencyKey });
      if (existing) return replay(existing);
    }
    throw error;
  }
}

async function finish(scope: InventoryScope, id: string, actor: TransferActor, action: "received" | "cancelled", reason = "") {
  actorRequired(actor);
  if (!Types.ObjectId.isValid(id)) inventoryError("Mã chứng từ điều chuyển không hợp lệ.");
  if (action === "cancelled" && !text(reason)) inventoryError("Lý do hủy chuyển kho là bắt buộc.");
  return inInventoryTransaction(async (session) => {
    const doc = await InventoryTransferModel.findOne({ _id: id, companyCode: scope.companyCode, ...(action === "received" ? { toBranchId: scope.branchId } : { fromBranchId: scope.branchId }) }).session(session);
    if (!doc) inventoryError("Không tìm thấy phiếu điều chuyển trong phạm vi được phép.", 404);
    if (!doc.transferCode && doc.code) {
      const [view] = await transferViews(scope.companyCode, [doc.toObject()]);
      doc.transferCode = view.transferCode;
      doc.fromWarehouseName = view.fromWarehouseName;
      doc.toWarehouseName = view.toWarehouseName;
      doc.createdByName = view.createdByName;
      doc.requestKey = doc.idempotencyKey || String(doc._id);
      for (const item of doc.items) if (!item.trackingMode) item.trackingMode = item.serialUnitIds.length ? "serial" : "quantity";
    }
    const destination = action === "received" ? doc.toWarehouseId : doc.fromWarehouseId;
    if (scope.warehouseId && scope.warehouseId !== destination) inventoryError("Kho không thuộc phạm vi thao tác.", 403);
    if (doc.status === action) return doc.toObject();
    if (doc.status !== "in_transit") inventoryError("Phiếu đã nhận hoặc đã hủy; không thể đổi trạng thái.", 409);
    await resolveInventoryWarehouse(scope, destination, session);
    for (const item of doc.items) {
      const balance = await InventoryBalanceModel.findOne({ companyCode: scope.companyCode, branchId: doc.fromBranchId, warehouseId: doc.transitWarehouseId, variantId: item.variantId }).session(session).lean();
      if (!balance || balance.quantity !== item.quantity || balance.reservedQuantity !== 0 || balance.averageCost !== item.unitCost) inventoryError("Tồn đang vận chuyển không khớp chứng từ; cần đối soát trước khi xử lý.", 409);
    }
    const base = { companyCode: scope.companyCode, purpose: "transfer" as const, sourceType: "inventory-transfer", sourceId: String(doc._id), sourceCode: doc.transferCode, operatorName: actor.name, items: doc.items.map((item) => item.toObject()), reason: reason || doc.reason, session, writeLegacyStockLog: false };
    await writeStockMovement({ ...base, branchId: doc.fromBranchId, warehouseId: doc.transitWarehouseId, direction: "out", idempotencyKey: `transfer:${id}:${action}:out` });
    await writeStockMovement({ ...base, branchId: scope.branchId, warehouseId: destination, direction: "in", idempotencyKey: `transfer:${id}:${action}:in` });
    for (const item of doc.items) for (const serialUnitId of item.serialUnitIds) {
      const changed = await SerialUnitModel.updateOne({ _id: serialUnitId, companyCode: scope.companyCode, branchId: doc.fromBranchId, warehouseId: doc.transitWarehouseId, status: "in_transit", currentDocumentType: "inventory-transfer", currentDocumentId: id }, { $set: { branchId: scope.branchId, warehouseId: destination, status: "in_stock", updatedBy: actor.id }, $unset: { transferToBranchId: 1, transferToWarehouseId: 1 } }, { session });
      if (changed.modifiedCount !== 1) inventoryError("Máy đang chuyển không khớp chứng từ; cần đối soát.", 409);
    }
    await events(doc, actor, action === "received" ? "transfer_received" : "transfer_cancelled", "in_transit", "in_stock", scope.branchId, session, reason);
    doc.status = action;
    if (action === "received") { doc.receivedBy = actor.id; doc.receivedByName = actor.name; doc.receivedAt = new Date(); }
    else { doc.cancelledBy = actor.id; doc.cancelledByName = actor.name; doc.cancelledAt = new Date(); doc.cancelReason = text(reason); }
    await doc.save({ session });
    await WarehouseModel.updateOne({ _id: doc.transitWarehouseId, companyCode: scope.companyCode, kind: "transit" }, { $set: { isActive: false } }, { session });
    return doc.toObject();
  });
}
export const acceptTransfer = (scope: InventoryScope, id: string, actor: TransferActor) => finish(scope, id, actor, "received");
export const cancelTransfer = (scope: InventoryScope, id: string, reason: string, actor: TransferActor) => finish(scope, id, actor, "cancelled", reason);

export async function listTransfers(scope: InventoryScope, query: { page?: unknown; status?: unknown; from?: unknown; to?: unknown } = {}) {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1)), limit = 20;
  const filter: Record<string, any> = { ...scoped(scope), ...(["in_transit", "received", "cancelled", "reversed"].includes(text(query.status)) ? { status: text(query.status) as "in_transit" | "received" | "cancelled" | "reversed" } : {}) };
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
      inventoryError("Khoảng thời gian lọc phiếu điều chuyển không hợp lệ.");
    }
    filter.createdAt = {
      ...(from ? { $gte: new Date(`${from}T00:00:00+07:00`) } : {}),
      ...(to ? { $lte: new Date(`${to}T23:59:59.999+07:00`) } : {}),
    };
  }
  const [items, total] = await Promise.all([InventoryTransferModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryTransferModel.countDocuments(filter)]);
  return { items: await transferViews(scope.companyCode, items), total, page, limit };
}
export async function getTransfer(scope: InventoryScope, id: string) {
  if (!Types.ObjectId.isValid(id)) inventoryError("Mã chứng từ không hợp lệ.");
  const doc = await InventoryTransferModel.findOne({ _id: id, ...scoped(scope) }).lean();
  if (!doc) inventoryError("Không tìm thấy phiếu điều chuyển.", 404);
  return (await transferViews(scope.companyCode, [doc]))[0];
}
export async function transferDestinations(companyCode: string) {
  const branches = await BranchModel.find({ companyCode, isActive: true }).select("name code").lean();
  const names = new Map(branches.map((branch) => [String(branch._id), `${branch.code} — ${branch.name}`]));
  // New branches may not have opened inventory yet. Provision their own empty
  // warehouse, while leaving deliberately deactivated warehouses unchanged.
  const initialized = new Set(await WarehouseModel.distinct("branchId", {
    companyCode, branchId: { $in: [...names.keys()] }, kind: { $ne: "transit" },
  }));
  for (const branchId of names.keys()) {
    if (!initialized.has(branchId)) await ensureDefaultWarehouse(companyCode, branchId);
  }
  const warehouses = await WarehouseModel.find({ companyCode, branchId: { $in: [...names.keys()] }, isActive: true, kind: { $ne: "transit" } }).select("branchId name code isDefault").sort({ branchId: 1, name: 1 }).lean();
  return warehouses.map((warehouse) => ({ ...warehouse, branchName: names.get(warehouse.branchId) }));
}
