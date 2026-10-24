import mongoose, { Types, type ClientSession } from "mongoose";
import { createHash } from "node:crypto";
import { BranchModel } from "../../../model/branch.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { SerialEventModel } from "../serials/serial-event.model";
import { InventoryTransferModel, type InventoryTransferItem } from "./transfer.model";
import { InventoryStockReversalModel } from "./stock-reversal.model";
import { normalizeSerialNumber } from "../serials/serial-state";

type Scope = { companyCode: string; branchId: string };
type Actor = { id: string; name: string };
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const asItems = (items: InventoryTransferItem[]) => items.map((item) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, productName: item.productName, quantity: item.quantity, unitCost: item.unitCost }));

async function moveSerials(transfer: any, from: "in_stock" | "in_transit", to: "in_stock" | "in_transit", branchId: string, warehouseId: string, eventType: string, actor: Actor, session: ClientSession) {
  for (const item of transfer.items as InventoryTransferItem[]) {
    for (const id of item.serialUnitIds) {
      const filter: Record<string, unknown> = { _id: id, companyCode: transfer.companyCode, variantId: item.variantId, status: from, currentDocumentId: from === "in_transit" ? String(transfer._id) : { $ne: String(transfer._id) } };
      if (from === "in_stock") Object.assign(filter, { branchId, warehouseId });
      else Object.assign(filter, { transferToBranchId: transfer.toBranchId });
      const update = to === "in_transit"
        ? { $set: { status: to, transferToBranchId: transfer.toBranchId, transferToWarehouseId: transfer.toWarehouseId, currentDocumentType: "inventory-transfer", currentDocumentId: String(transfer._id), updatedBy: actor.id } }
        : { $set: { status: to, branchId, warehouseId, currentDocumentType: "inventory-transfer", currentDocumentId: String(transfer._id), updatedBy: actor.id }, $unset: { transferToBranchId: 1, transferToWarehouseId: 1 } };
      const unit = await SerialUnitModel.findOneAndUpdate(filter, update, { returnDocument: "after", session });
      if (!unit) throw fail(`IMEI của ${item.sku} đã thay đổi trạng thái hoặc không ở kho hợp lệ.`, 409);
      await SerialEventModel.create([{ companyCode: transfer.companyCode, branchId, serialUnitId: id, serialNumber: unit.serialNumber,
        eventType, fromStatus: from, toStatus: to, documentType: "inventory-transfer", documentId: String(transfer._id),
        reason: transfer.reason, actorId: actor.id, actorName: actor.name }], { session });
    }
  }
}

export function validateTransferRequest(input: any) {
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const toBranchId = String(input.toBranchId || "").trim();
  const fromWarehouseId = String(input.fromWarehouseId || "").trim();
  const toWarehouseId = String(input.toWarehouseId || "").trim();
  const reason = String(input.reason || "").trim();
  if (!toBranchId || !fromWarehouseId || !toWarehouseId || !reason) throw fail("Chi nhánh, hai kho và lý do điều chuyển là bắt buộc.");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw fail("Khóa chống gửi lặp của phiếu không hợp lệ.");
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw fail("Phiếu phải có từ 1 đến 100 dòng hàng.");
  const ids = new Set<string>();
  const serialIds = new Set<string>();
  const items = input.items.map((raw: any) => {
    const variantId = String(raw.variantId || "");
    const quantity = Number(raw.quantity);
    const units: string[] = Array.isArray(raw.serialNumbers) ? raw.serialNumbers.map((value: unknown) => normalizeSerialNumber(String(value))) : [];
    if (!Types.ObjectId.isValid(variantId) || !Number.isSafeInteger(quantity) || quantity < 1 || ids.has(variantId)) throw fail("Dòng hàng trùng hoặc số lượng không hợp lệ.");
    if (units.some((id: string) => serialIds.has(id)) || new Set(units).size !== units.length) throw fail("IMEI trong phiếu bị trùng.");
    ids.add(variantId); units.forEach((id: string) => serialIds.add(id));
    return { variantId, quantity, serialNumbers: units };
  });
  return { idempotencyKey, toBranchId, fromWarehouseId, toWarehouseId, reason, items };
}

export async function requestInventoryTransfer(scope: Scope, input: any, actor: Actor) {
  const values = validateTransferRequest(input);
  const requestFingerprint = createHash("sha256").update(JSON.stringify({ scope, values })).digest("hex");
  const prior = await InventoryTransferModel.findOne({ companyCode: scope.companyCode, idempotencyKey: values.idempotencyKey }).lean();
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint) throw fail("Khóa yêu cầu đã được dùng cho phiếu khác.", 409);
    return prior;
  }
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const toBranch = await BranchModel.findOne({ _id: values.toBranchId, companyCode: scope.companyCode, isActive: true }).session(session).lean();
      const warehouses = await WarehouseModel.find({ companyCode: scope.companyCode, isActive: true, _id: { $in: [values.fromWarehouseId, values.toWarehouseId] } }).session(session).lean();
      const fromWarehouse = warehouses.find((warehouse) => String(warehouse._id) === values.fromWarehouseId && warehouse.branchId === scope.branchId);
      const toWarehouse = warehouses.find((warehouse) => String(warehouse._id) === values.toWarehouseId && warehouse.branchId === values.toBranchId);
      if (!toBranch || !fromWarehouse || !toWarehouse || values.fromWarehouseId === values.toWarehouseId) throw fail("Chi nhánh hoặc kho điều chuyển không hợp lệ.");
      const snapshots: InventoryTransferItem[] = [];
      for (const item of values.items) {
        const variant = await ProductVariantModel.findOne({ _id: item.variantId, companyCode: scope.companyCode, status: "active" }).session(session).lean();
        if (!variant) throw fail("SKU điều chuyển không tồn tại hoặc đã ngừng hoạt động.");
        const product = await ProductCatalogModel.findOne({ _id: variant.productId, companyCode: scope.companyCode, status: "active" }).session(session).lean();
        const balance = await InventoryBalanceModel.findOne({ companyCode: scope.companyCode, warehouseId: values.fromWarehouseId, variantId: item.variantId }).session(session).lean();
        if (!product || !balance) throw fail("Không tìm thấy hàng trong kho gửi.");
        if (Number(balance.quantity) - Number(balance.reservedQuantity) < item.quantity) throw fail(`SKU ${variant.sku} không đủ tồn khả dụng.`, 409);
        const serialTracked = variant.trackingMode === "serial" || variant.trackingMode === "unit_barcode";
        if (serialTracked && item.serialNumbers.length !== item.quantity || !serialTracked && item.serialNumbers.length) throw fail(`SKU ${variant.sku} phải khai báo đúng số IMEI/mã đơn vị.`);
        const serialUnits = item.serialNumbers.length ? await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId,
          warehouseId: values.fromWarehouseId, variantId: item.variantId, status: "in_stock", normalizedSerialNumber: { $in: item.serialNumbers } }).session(session).lean() : [];
        if (serialUnits.length !== item.serialNumbers.length) throw fail(`IMEI của ${variant.sku} không ở kho gửi hoặc không sẵn sàng.`, 409);
        snapshots.push({ productId: String(variant.productId), variantId: item.variantId, sku: variant.sku, productName: product.name,
          quantity: item.quantity, unitCost: Number(balance.averageCost || 0), serialUnitIds: serialUnits.map((unit) => String(unit._id)) });
      }
      const _id = new Types.ObjectId();
      const code = `DC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(_id).slice(-8).toUpperCase()}`;
      const [transfer] = await InventoryTransferModel.create([{ _id, companyCode: scope.companyCode, fromBranchId: scope.branchId,
        fromWarehouseId: values.fromWarehouseId, toBranchId: values.toBranchId, toWarehouseId: values.toWarehouseId,
        code, idempotencyKey: values.idempotencyKey, requestFingerprint, status: "in_transit", items: snapshots, reason: values.reason, createdBy: actor.id, version: 0 }], { session });
      await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: values.fromWarehouseId,
        direction: "out", purpose: "transfer", sourceType: "inventory-transfer", sourceId: String(_id), sourceCode: code,
        idempotencyKey: `transfer:${_id}:out`, operatorName: actor.name, items: asItems(snapshots), reason: values.reason, session });
      await moveSerials(transfer, "in_stock", "in_transit", scope.branchId, values.fromWarehouseId, "transfer_requested", actor, session);
      result = transfer;
    });
    return result;
  } catch (error: any) {
    if (error?.code === 11000) {
      const replay = await InventoryTransferModel.findOne({ companyCode: scope.companyCode, idempotencyKey: values.idempotencyKey }).lean();
      if (replay?.requestFingerprint === requestFingerprint) return replay;
      throw fail("Khóa yêu cầu đã được dùng cho phiếu khác.", 409);
    }
    throw error;
  } finally { await session.endSession(); }
}

export async function receiveInventoryTransfer(scope: Scope, id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw fail("Phiếu điều chuyển không hợp lệ.");
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const transfer = await InventoryTransferModel.findOne({ _id: id, companyCode: scope.companyCode, toBranchId: scope.branchId, status: "in_transit" }).session(session);
      if (!transfer) throw fail("Phiếu không còn ở trạng thái chờ nhận hoặc không thuộc chi nhánh này.", 409);
      await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: transfer.toWarehouseId,
        direction: "in", purpose: "transfer", sourceType: "inventory-transfer", sourceId: id, sourceCode: transfer.code,
        idempotencyKey: `transfer:${id}:in`, operatorName: actor.name, items: asItems(transfer.items), reason: transfer.reason, session });
      await moveSerials(transfer, "in_transit", "in_stock", scope.branchId, transfer.toWarehouseId, "transfer_received", actor, session);
      transfer.status = "received"; transfer.receivedBy = actor.id; transfer.receivedAt = new Date(); transfer.version += 1;
      await transfer.save({ session }); result = transfer;
    });
    return result;
  } finally { await session.endSession(); }
}

export async function cancelInventoryTransfer(scope: Scope, id: string, reason: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id) || !reason?.trim()) throw fail("Phiếu và lý do hủy là bắt buộc.");
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const transfer = await InventoryTransferModel.findOne({ _id: id, companyCode: scope.companyCode, fromBranchId: scope.branchId, status: "in_transit" }).session(session);
      if (!transfer) throw fail("Chỉ kho gửi được hủy phiếu đang chuyển.", 409);
      await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: transfer.fromWarehouseId,
        direction: "in", purpose: "cancel", sourceType: "inventory-transfer-cancel", sourceId: id, sourceCode: transfer.code,
        idempotencyKey: `transfer:${id}:cancel`, operatorName: actor.name, items: asItems(transfer.items), reason: reason.trim(), session });
      await moveSerials(transfer, "in_transit", "in_stock", scope.branchId, transfer.fromWarehouseId, "transfer_cancelled", actor, session);
      transfer.status = "cancelled"; transfer.cancelReason = reason.trim(); transfer.cancelledBy = actor.id; transfer.cancelledAt = new Date(); transfer.version += 1;
      await transfer.save({ session }); result = transfer;
    });
    return result;
  } finally { await session.endSession(); }
}

export async function reverseInventoryTransfer(scope: Scope, id: string, reason: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id) || !reason?.trim()) throw fail("Phiếu và lý do đảo là bắt buộc.");
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const transfer = await InventoryTransferModel.findOne({ _id: id, companyCode: scope.companyCode, toBranchId: scope.branchId, status: "received" }).session(session);
      if (!transfer) throw fail("Chỉ kho nhận được đảo phiếu đã nhận.", 409);
      await InventoryStockReversalModel.create([{ companyCode: scope.companyCode, sourceType: "inventory-transfer", sourceId: id, reason: reason.trim(), createdBy: actor.id }], { session });
      await writeStockMovement({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: transfer.toWarehouseId,
        direction: "out", purpose: "cancel", sourceType: "inventory-transfer-reversal", sourceId: id, sourceCode: transfer.code,
        idempotencyKey: `transfer:${id}:reverse-out`, operatorName: actor.name, items: asItems(transfer.items), reason: reason.trim(), session });
      await writeStockMovement({ companyCode: scope.companyCode, branchId: transfer.fromBranchId, warehouseId: transfer.fromWarehouseId,
        direction: "in", purpose: "cancel", sourceType: "inventory-transfer-reversal", sourceId: id, sourceCode: transfer.code,
        idempotencyKey: `transfer:${id}:reverse-in`, operatorName: actor.name, items: asItems(transfer.items), reason: reason.trim(), session });
      for (const item of transfer.items) for (const serialId of item.serialUnitIds) {
        const serial = await SerialUnitModel.findOneAndUpdate({ _id: serialId, companyCode: scope.companyCode, branchId: scope.branchId,
          warehouseId: transfer.toWarehouseId, status: "in_stock", currentDocumentId: id },
          { $set: { branchId: transfer.fromBranchId, warehouseId: transfer.fromWarehouseId, currentDocumentType: "inventory-transfer-reversal", updatedBy: actor.id } }, { returnDocument: "after", session });
        if (!serial) throw fail("IMEI đã phát sinh giao dịch khác; không thể đảo phiếu.", 409);
        await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: transfer.fromBranchId, serialUnitId: serialId,
          serialNumber: serial.serialNumber, eventType: "transfer_reversed", fromStatus: "in_stock", toStatus: "in_stock",
          documentType: "inventory-transfer-reversal", documentId: id, reason: reason.trim(), actorId: actor.id, actorName: actor.name }], { session });
      }
      transfer.status = "reversed"; transfer.reversalReason = reason.trim(); transfer.reversedBy = actor.id; transfer.reversedAt = new Date(); transfer.version += 1;
      await transfer.save({ session }); result = transfer;
    });
    return result;
  } finally { await session.endSession(); }
}

export async function listInventoryTransfers(companyCode: string, branchId: string) {
  return InventoryTransferModel.find({ companyCode, $or: [{ fromBranchId: branchId }, { toBranchId: branchId }] }).sort({ createdAt: -1 }).limit(200).lean();
}
