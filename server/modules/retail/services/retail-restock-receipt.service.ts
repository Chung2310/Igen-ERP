import type { ClientSession } from "mongoose";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import type { RetailBranchScope } from "../contracts";

/** The receipt is the stock source; never post a second after-sale movement. */
export async function createRetailRestockReceipt(scope: RetailBranchScope, input: {
  kind: "sales_return" | "buyback" | "sales_cancel";
  sourceId: string; sourceCode: string; order: any; items: any[];
  reason: string; actorId: string; actorName: string; idempotencyKey: string;
  warehouseId?: string; receivedAt?: Date;
  existingLedgerSource?: { sourceType: "retail-after-sale"; sourceId: string };
}, session: ClientSession) {
  const existing = await GoodsReceiptModel.findOne({ ...scope, idempotencyKey: input.idempotencyKey }).session(session);
  if (existing) return existing;
  const warehouse = input.warehouseId ? { _id: input.warehouseId } : await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  if (input.existingLedgerSource) {
    const entries = await InventoryLedgerEntryModel.find({ ...scope, idempotencyKey: input.idempotencyKey }).sort({ sourceLine: 1 }).session(session).lean();
    const matches = entries.length === input.items.length && entries.length > 0 && entries.every((entry, index) => {
      const item = input.items[index];
      return entry.sourceType === input.existingLedgerSource!.sourceType && entry.sourceId === input.existingLedgerSource!.sourceId
        && entry.sourceLine === index && entry.direction === "in" && entry.warehouseId === String(warehouse._id)
        && entry.productId === item.productId && String(entry.variantId || "") === String(item.variantId || "")
        && entry.sku === item.sku && entry.quantity === item.quantity && entry.unitCost === item.unitCost;
    });
    if (!matches) throw Object.assign(new Error("Sổ kho lịch sử không khớp chứng từ cần bổ sung."), { statusCode: 409 });
  }
  const items = [];
  for (const item of input.items) {
    const units = item.trackingMode === "serial" || item.trackingMode === "unit_barcode"
      ? await SerialUnitModel.find({ ...scope, soldOrderId: String(input.order._id), ...(item.trackingMode === "serial"
        ? { normalizedSerialNumber: { $in: item.serialNumbers } }
        : { $or: [{ normalizedInternalBarcode: { $in: item.internalBarcodes } }, { normalizedBarcodeAliases: { $in: item.internalBarcodes } }] }) }).session(session).lean()
      : [];
    items.push({ ...item, lineTotal: item.quantity * item.unitCost,
      unitDetails: units.map((unit) => ({ internalBarcode: unit.internalBarcode, barcodeAliases: unit.barcodeAliases, serialNumber: unit.serialNumber, imei1: unit.imei1, imei2: unit.imei2 })),
    });
  }
  const now = input.receivedAt || new Date();
  const [receipt] = await GoodsReceiptModel.create([{
    ...scope, warehouseId: String(warehouse._id), receiptCode: `PN-${input.sourceCode}`,
    receiptKind: input.kind, sourceId: input.sourceId, sourceCode: input.sourceCode,
    orderId: String(input.order._id), orderCode: input.order.orderCode,
    customerId: input.order.customerId, customerName: input.order.customerName || "Khách lẻ",
    supplierName: input.order.customerName || "Khách lẻ", status: "confirmed",
    receivedAt: now, confirmedAt: now, confirmedBy: input.actorId, confirmedByName: input.actorName,
    createdBy: input.actorId, createdByName: input.actorName, items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    notes: `${input.kind === "buyback" ? "Thu mua lại" : input.kind === "sales_cancel" ? "Hủy đơn" : "Trả hàng"} từ đơn ${input.order.orderCode}. ${input.reason}`,
    idempotencyKey: input.idempotencyKey, version: 0,
  }], { session });
  if (!input.existingLedgerSource) await writeStockMovement({ ...scope, warehouseId: String(warehouse._id), direction: "in",
    purpose: input.kind === "buyback" ? "purchase" : input.kind === "sales_cancel" ? "cancel" : "sales-return",
    sourceType: "goods-receipt", sourceId: String(receipt._id), sourceCode: receipt.receiptCode,
    idempotencyKey: input.idempotencyKey, operatorName: input.actorName,
    items: input.items, reason: receipt.notes, session,
  });
  return receipt;
}
