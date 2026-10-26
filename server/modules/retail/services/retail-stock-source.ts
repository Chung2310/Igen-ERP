import type { ClientSession } from "mongoose";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import type { RetailBranchScope } from "../contracts";
import type { RetailOrderItem } from "../interfaces/retail-order.interface";

export function retailStockSourceError(): never {
  throw Object.assign(new Error("Chứng từ bán hàng không khớp sổ xuất kho gốc. Cần đối soát trước khi hủy/trả hàng."), { code: "RETAIL_STOCK_SOURCE_CONFLICT", status: 409, statusCode: 409 });
}

/** Read the original posting, never infer the source warehouse or cost from current catalog data. */
export async function loadRetailStockSource(scope: RetailBranchScope, orderId: string, items: RetailOrderItem[], session: ClientSession) {
  const entries = await InventoryLedgerEntryModel.find({ companyCode: scope.companyCode, idempotencyKey: `order:${orderId}:out` }).sort({ sourceLine: 1 }).session(session).lean();
  if (!items.length || entries.length !== items.length) retailStockSourceError();
  const warehouseId = entries[0].warehouseId;
  for (const [index, entry] of entries.entries()) {
    const item = items[index];
    const identityMatches = entry.variantId
      ? String(item.productId) === entry.variantId && (!item.variantId || item.variantId === entry.variantId)
      : String(item.productId) === entry.productId && !item.variantId;
    if (entry.branchId !== scope.branchId || entry.warehouseId !== warehouseId || !warehouseId
      || entry.sourceType !== "retail-order" || entry.sourceId !== orderId || entry.sourceLine !== index
      || entry.direction !== "out" || entry.purpose !== "sale" || !identityMatches
      || entry.sku !== String(item.sku).trim().toUpperCase() || entry.quantity !== item.quantity || entry.quantityDelta !== -item.quantity
      || !Number.isFinite(entry.unitCost) || entry.unitCost < 0 || entry.unitCost !== item.unitCost
      || (item.stockLedgerId && item.stockLedgerId !== String(entry._id))
      || (item.stockWarehouseId && item.stockWarehouseId !== warehouseId)) retailStockSourceError();
  }
  return { warehouseId, entries };
}

export function restockItemFromSource(item: any, entry: { productId: string; variantId?: string; unitCost: number }) {
  const plain = item.toObject?.() || item;
  return { ...plain, productId: entry.productId, variantId: entry.variantId,
    legacyProductId: entry.variantId ? undefined : entry.productId, unitCost: entry.unitCost };
}

/** totalCost is net of returns; buybacks are separate purchases and do not reverse sale cost. */
export function remainingRetailCost(items: RetailOrderItem[], returns: Array<{ type: string; items?: any[] }>) {
  const returned = new Map<number, number>();
  for (const doc of returns) {
    if (doc.type !== "return") continue;
    for (const item of doc.items || []) {
      const source = items[item.orderLineIndex];
      if (!Number.isSafeInteger(item.orderLineIndex) || !source || item.productId !== source.productId
        || item.sku !== source.sku || item.unitCost !== source.unitCost || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) retailStockSourceError();
      const quantity = (returned.get(item.orderLineIndex) || 0) + item.quantity;
      if (quantity > source.quantity) retailStockSourceError();
      returned.set(item.orderLineIndex, quantity);
    }
  }
  return items.reduce((total, item, index) => total + (item.quantity - (returned.get(index) || 0)) * item.unitCost, 0);
}
