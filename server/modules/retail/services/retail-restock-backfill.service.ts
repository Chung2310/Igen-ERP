import mongoose from "mongoose";
import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { StockLogModel } from "../../../model/stock-log.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { createRetailRestockReceipt } from "./retail-restock-receipt.service";
import { summarizeAfterSales } from "./retail-after-sale-history";
import type { RetailBranchScope } from "../contracts";

/** Only documents with a complete stock ledger can be backfilled. No stock is posted again. */
export async function backfillRetailRestockReceipts(scope: RetailBranchScope, apply = false) {
  const results: Array<{ code: string; status: string; receiptCode?: string }> = [];
  const documents = await RetailAfterSaleModel.find({ ...scope, receiptId: { $exists: false } }).lean();
  for (const document of documents) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const doc = await RetailAfterSaleModel.findOne({ _id: document._id, ...scope }).session(session);
        if (!doc || doc.receiptId) return;
        const key = `after-sale:${doc._id}:in`;
        const entries = await InventoryLedgerEntryModel.find({ ...scope, idempotencyKey: key }).sort({ sourceLine: 1 }).session(session).lean();
        const order = await RetailOrderModel.findOne({ _id: doc.orderId, ...scope }).session(session);
        const matches = order && entries.length === doc.items.length && entries.every((entry, index) =>
          entry.sourceType === "retail-after-sale" && entry.sourceId === String(doc._id)
          && entry.sourceLine === index && entry.direction === "in" && entry.quantity === doc.items[index].quantity
          && entry.unitCost === doc.items[index].unitCost
          && entry.sku === doc.items[index].sku && entry.warehouseId === entries[0].warehouseId);
        if (!matches) { results.push({ code: doc.code, status: "needs_review" }); return; }
        if (!apply) { results.push({ code: doc.code, status: "ready" }); return; }
        const receipt = await createRetailRestockReceipt(scope, {
          kind: doc.type === "return" ? "sales_return" : "buyback", sourceId: String(doc._id), sourceCode: doc.code,
          order, items: doc.items.map((item, index) => ({ ...item.toObject(), productId: entries[index].productId,
            ...(entries[index].variantId ? { variantId: entries[index].variantId } : { legacyProductId: entries[index].productId }),
          })), reason: doc.reason, actorId: doc.createdBy, actorName: doc.createdByName,
          idempotencyKey: key, warehouseId: entries[0].warehouseId, receivedAt: doc.createdAt,
          existingLedgerSource: { sourceType: "retail-after-sale", sourceId: String(doc._id) },
        }, session);
        // The historical source is verified explicitly; no new stock movement is written.
        await InventoryLedgerEntryModel.updateMany({ ...scope, idempotencyKey: key }, { $set: { sourceType: "goods-receipt", sourceId: String(receipt._id), sourceCode: receipt.receiptCode } }, { session });
        await StockLogModel.updateMany({ ...scope, idempotencyKey: key }, { $set: { refType: "goods-receipt", refId: String(receipt._id) } }, { session });
        doc.receiptId = String(receipt._id);
        doc.receiptCode = receipt.receiptCode;
        await doc.save({ session });
        const history = await RetailAfterSaleModel.find({ ...scope, orderId: doc.orderId }).session(session).lean();
        order.afterSaleStatus = summarizeAfterSales(order, history).status;
        order.version += 1;
        await order.save({ session });
        results.push({ code: doc.code, status: "created", receiptCode: receipt.receiptCode });
      });
    } finally { await session.endSession(); }
  }
  return results;
}
