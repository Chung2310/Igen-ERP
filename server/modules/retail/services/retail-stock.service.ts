import type { ClientSession } from "mongoose";
import { ProductModel } from "../../../model/product.model";
import { StockLogModel } from "../../../model/stock-log.model";
import type { RetailBranchScope } from "../contracts";
import type { RetailOrderItem } from "../interfaces/retail-order.interface";

export async function applyOrderStockOut(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, allowNegativeStock: boolean, session: ClientSession) {
  for (const item of items) {
    const filter: Record<string, unknown> = { _id: item.productId, ...scope };
    if (!allowNegativeStock) filter.stock = { $gte: item.quantity };
    const updated = await ProductModel.updateOne(filter, { $inc: { stock: -item.quantity } }, { session });
    if (updated.modifiedCount !== 1) throw Object.assign(new Error(`Sản phẩm ${item.sku} không đủ tồn khả dụng.`), { code: "INSUFFICIENT_STOCK", status: 409, details: { sku: item.sku, requested: item.quantity } });
  }
  await StockLogModel.create([{ type: "xuất", title: `Xuất bán lẻ ${orderCode}`, items, purpose: "bán", operatorName, status: "Thành công", ...scope, refType: "retail-order", refId: orderId, idempotencyKey: `order:${orderId}:out`, notes: `Đơn bán lẻ ${orderCode}` }], { session });
}

export async function revertOrderStock(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, session: ClientSession) {
  for (const item of items) await ProductModel.updateOne({ _id: item.productId, ...scope }, { $inc: { stock: item.quantity } }, { session });
  await StockLogModel.create([{ type: "nhập", title: `Hoàn tồn ${orderCode}`, items, purpose: "hủy", operatorName, status: "Thành công", ...scope, refType: "retail-order", refId: orderId, idempotencyKey: `order:${orderId}:revert`, notes: `Hủy đơn bán lẻ ${orderCode}` }], { session });
}
