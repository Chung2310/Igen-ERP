import { Types } from "mongoose";
import { StockLogModel } from "../../model/stock-log.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { ProductModel } from "../../model/product.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { inInventoryTransaction } from "./inventory-transaction";
import { inventoryError, rejectScopeOverrides, resolveInventoryWarehouse, type InventoryScope } from "./inventory-scope";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";

/** Full reversal of manual outbound only. Source business documents own their debt/return workflows. */
export async function reverseManualOutbound(scope: InventoryScope, sourceId: string, input: { reason: string }, actor: { id: string; name: string }) {
  rejectScopeOverrides(input);
  if (Object.keys(input).some((key) => key !== "reason")) inventoryError("Chứng từ đảo chỉ nhận lý do; kho, hàng và giá vốn lấy từ phiếu gốc.");
  const reason = String(input.reason || "").trim();
  if (!Types.ObjectId.isValid(sourceId) || !reason || reason.length > 2000 || !actor.id?.trim() || !actor.name?.trim()) inventoryError("Cần phiếu gốc, lý do (tối đa 2000 ký tự) và người thực hiện hợp lệ.");
  return inInventoryTransaction(async (session) => {
    const original = await StockLogModel.findOne({ _id: sourceId, companyCode: scope.companyCode, branchId: scope.branchId }).session(session);
    if (!original) inventoryError("Không tìm thấy phiếu trong chi nhánh.", 404);
    if (scope.warehouseId && scope.warehouseId !== original.warehouseId) inventoryError("Kho không thuộc phạm vi thao tác.", 403);
    if (original.reversalId) {
      const existing = await StockLogModel.findOne({ _id: original.reversalId, companyCode: scope.companyCode, branchId: scope.branchId, reversalOf: sourceId }).session(session);
      if (!existing || existing.notes !== reason) inventoryError("Phiếu đã được đảo. Hãy kiểm tra chứng từ đảo đã có.", 409);
      return existing.toObject();
    }
    if (original.type !== "xuất" || !["Hoàn thành", "Thành công"].includes(original.status) || original.refType || original.refId || original.reversalOf || original.purpose === "chuyển kho") inventoryError("Chỉ đảo nguyên phiếu xuất thủ công đã ghi sổ. Phiếu nhập, bán lẻ và điều chuyển phải xử lý theo chứng từ nguồn.", 409);
    await resolveInventoryWarehouse(scope, original.warehouseId, session);
    const entries = await InventoryLedgerEntryModel.find({ companyCode: scope.companyCode, sourceType: "manual-stock-log", sourceId }).sort({ sourceLine: 1 }).session(session).lean();
    if (!entries.length || entries.length !== original.items.length) inventoryError("Thiếu ledger gốc để đối chiếu. Cần đối soát trước khi đảo.", 409);
    const originalEvents = await SerialEventModel.find({ companyCode: scope.companyCode, documentType: "manual-stock-log", documentId: sourceId }).session(session).lean();
    const expectedStatus = original.purpose === "nội bộ" ? "internal_use" : original.purpose === "hủy" ? "scrapped" : "sold";
    const restoredUnits: Array<{ id: string; serialNumber: string }> = [];
    const seen = new Set<string>();
    const items: any[] = [];
    for (const [index, item] of original.items.entries()) {
      const entry = entries[index];
      if (entry.sourceLine !== index || entry.direction !== "out" || entry.branchId !== scope.branchId || entry.warehouseId !== original.warehouseId || entry.productId !== item.productId || String(entry.variantId || "") !== String(item.variantId || "") || entry.sku !== item.sku || entry.quantity !== item.quantity || entry.quantityDelta !== -item.quantity || entry.unitCost !== item.unitCost || !Number.isFinite(entry.unitCost) || entry.unitCost < 0) inventoryError("Phiếu và ledger gốc không khớp; không thể tự đảo.", 409);
      const variant = item.variantId ? await ProductVariantModel.findOne({ _id: item.variantId, companyCode: scope.companyCode, productId: item.productId }).session(session).lean() : null;
      const legacy = !item.variantId ? await ProductModel.findOne({ _id: item.productId, companyCode: scope.companyCode, branchId: scope.branchId }).session(session).lean() : null;
      if (!variant && !legacy) inventoryError("Không tìm thấy SKU gốc để hoàn tồn.", 409);
      const balance = await InventoryBalanceModel.findOne({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: original.warehouseId, productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : { variantId: { $exists: false }, sku: item.sku }) }).session(session).lean();
      if (!balance || !Number.isFinite(balance.quantity) || balance.quantity < 0 || !Number.isFinite(balance.averageCost) || balance.averageCost < 0) inventoryError("Tồn hiện tại bị thiếu hoặc không hợp lệ; cần đối soát trước khi hoàn kho.", 409);
      const trackingMode = item.trackingMode || variant?.trackingMode || "quantity";
      const identifiers = item.unitIdentifiers?.length ? item.unitIdentifiers : item.serialNumbers || [];
      if (["serial", "unit_barcode"].includes(trackingMode)) {
        if (!Number.isInteger(item.quantity) || identifiers.length !== item.quantity) inventoryError("Thiếu danh sách máy gốc để đảo.", 409);
        for (const identifier of identifiers) {
          const code = identifier.trim().toUpperCase();
          const matches = await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: original.warehouseId, productId: item.productId, variantId: item.variantId, status: expectedStatus, currentDocumentType: "manual-stock-log", currentDocumentId: sourceId, $or: [{ normalizedSerialNumber: code }, { normalizedInternalBarcode: code }, { normalizedBarcodeAliases: code }] }).session(session);
          if (matches.length !== 1 || seen.has(String(matches[0]._id))) inventoryError(`Máy ${identifier} đã đổi trạng thái/vị trí hoặc không khớp phiếu. Cần xử lý chuỗi nghiệp vụ trước.`, 409);
          const unit = matches[0], id = String(unit._id);
          if (expectedStatus === "internal_use" && (unit.internalUse?.stockLogId !== sourceId || unit.internalUse?.recipientName !== String(original.customerName || "").trim() || unit.internalUse?.unitCost !== entry.unitCost)) inventoryError("Thông tin cấp phát không khớp phiếu gốc; cần đối soát trước khi thu hồi.", 409);
          const events = originalEvents.filter((event) => event.serialUnitId === id && event.branchId === scope.branchId && event.fromStatus === "in_stock" && event.toStatus === expectedStatus);
          const lastEvent = await SerialEventModel.findOne({ companyCode: scope.companyCode, serialUnitId: id }).sort({ occurredAt: -1, _id: -1 }).session(session).lean();
          if (events.length !== 1 || String(lastEvent?._id) !== String(events[0]._id)) inventoryError("Máy đã có nghiệp vụ sau phiếu gốc hoặc thiếu sự kiện gốc; không thể ép hoàn tác.", 409);
          seen.add(id); restoredUnits.push({ id, serialNumber: unit.serialNumber });
        }
      } else if (identifiers.length) inventoryError("Tracking mode không khớp danh sách máy gốc.", 409);
      items.push({ ...(item as any).toObject(), ...(legacy ? { legacyProductId: item.productId } : {}), unitCost: entry.unitCost, trackingMode });
    }
    if (originalEvents.length !== restoredUnits.length) inventoryError("Sự kiện máy không khớp số máy trên phiếu gốc.", 409);
    const reversal = new StockLogModel({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: original.warehouseId, type: "nhập", status: "Hoàn thành", title: `Đảo phiếu: ${original.title || sourceId}`, notes: reason, operatorName: actor.name, createdById: actor.id, reversalOf: sourceId, refType: "stock-log-reversal", refId: sourceId, items, quantity: original.quantity, sku: original.sku, productName: original.productName, idempotencyKey: `stock-log-reversal:${sourceId}` });
    // Serialize competing reversals on the source before any unique-key inserts.
    original.reversalId = String(reversal._id);
    original.reversedAt = new Date();
    await original.save({ session });
    await writeStockMovement({ ...scope, warehouseId: original.warehouseId, direction: "in", purpose: "other", sourceType: "stock-log-reversal", sourceId: String(reversal._id), sourceCode: reversal.title, idempotencyKey: `stock-log-reversal:${sourceId}`, operatorName: actor.name, reason, items, session, writeLegacyStockLog: false });
    for (const unit of restoredUnits) {
      const changed = await SerialUnitModel.updateOne({ _id: unit.id, companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: original.warehouseId, status: expectedStatus, currentDocumentType: "manual-stock-log", currentDocumentId: sourceId }, { $set: { status: "in_stock", currentDocumentType: "stock-log-reversal", currentDocumentId: String(reversal._id), updatedBy: actor.id }, ...(expectedStatus === "internal_use" ? { $unset: { internalUse: 1 } } : {}) }, { session });
      if (changed.modifiedCount !== 1) inventoryError("Máy vừa thay đổi. Vui lòng tải lại.", 409);
      await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: unit.id, serialNumber: unit.serialNumber, eventType: "stock_log_reversed", fromStatus: expectedStatus, toStatus: "in_stock", documentType: "stock-log-reversal", documentId: String(reversal._id), reason, actorId: actor.id, actorName: actor.name }], { session });
    }
    await reversal.save({ session });
    return reversal.toObject();
  });
}
