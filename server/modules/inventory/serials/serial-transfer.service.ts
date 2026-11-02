import { SerialUnitModel } from "./serial-unit.model";
import { InventoryTransferModel } from "../transfers/transfer.model";
import { acceptTransfer, cancelTransfer, createTransfer, getTransfer, type TransferActor } from "../transfers/transfer.service";
import { inventoryError, type InventoryScope } from "../inventory-scope";

/** Compatibility endpoints delegate to the same document workflow as bulk transfers. */
export async function requestSerialTransfer(scope: InventoryScope, id: string, input: { toBranchId: string; toWarehouseId?: string; reason: string; idempotencyKey?: string }, actor: TransferActor) {
  const key = String(input.idempotencyKey || "").trim();
  if (!key) inventoryError("Thiếu khóa yêu cầu điều chuyển. Vui lòng tải lại trang.");
  const existing = await InventoryTransferModel.findOne({ companyCode: scope.companyCode, fromBranchId: scope.branchId, requestKey: key }).lean();
  const unit = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode }).lean();
  if (!unit || (!existing && unit.branchId !== scope.branchId)) inventoryError("Không tìm thấy máy trong chi nhánh gửi.", 404);
  const doc = await createTransfer(scope, {
    fromWarehouseId: existing?.fromWarehouseId || String(unit.warehouseId || ""),
    toBranchId: input.toBranchId, toWarehouseId: input.toWarehouseId,
    reason: input.reason, idempotencyKey: key,
    items: [{ productId: unit.productId, variantId: String(unit.variantId || ""), sku: unit.sku, quantity: 1, unitIdentifiers: [unit.internalBarcode] }],
  }, actor);
  return { ...(await SerialUnitModel.findById(id).lean()), transferId: String(doc._id) };
}

async function documentForUnit(scope: InventoryScope, id: string, transferId?: string) {
  if (!transferId) inventoryError("Cần mã chứng từ điều chuyển để tránh xử lý nhầm chuyến. Vui lòng tải lại trang.");
  const doc = await getTransfer(scope, transferId);
  if (!doc.items.some((item) => item.serialUnitIds.includes(id))) inventoryError("Máy không thuộc chứng từ điều chuyển.", 409);
  // An old per-unit button cannot silently accept/cancel other machines on a bulk document.
  if (doc.items.length !== 1 || doc.items[0].quantity !== 1) inventoryError("Phiếu có nhiều hàng. Hãy xử lý nguyên phiếu tại mục Điều chuyển.", 409);
  return doc;
}

export async function acceptSerialTransfer(scope: InventoryScope, id: string, input: { warehouseId?: string; transferId?: string }, actor: TransferActor) {
  const doc = await documentForUnit(scope, id, input.transferId);
  if (input.warehouseId && input.warehouseId !== doc.toWarehouseId) inventoryError("Kho nhận phải khớp chứng từ điều chuyển.", 409);
  await acceptTransfer(scope, String(doc._id), actor);
  return SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode }).lean();
}

export async function cancelSerialTransfer(scope: InventoryScope, id: string, reason: string, actor: TransferActor, transferId?: string) {
  const doc = await documentForUnit(scope, id, transferId);
  await cancelTransfer(scope, String(doc._id), reason, actor);
  return SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode }).lean();
}
