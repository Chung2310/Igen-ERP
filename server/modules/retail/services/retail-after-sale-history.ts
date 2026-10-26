import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import type { RetailBranchScope } from "../contracts";

export function summarizeAfterSales(order: any, history: any[]) {
  const returned = history.filter((doc) => doc.type === "return").reduce((sum, doc) => sum + doc.items.reduce((n: number, item: any) => n + item.quantity, 0), 0);
  const boughtBack = history.filter((doc) => doc.type === "buyback").reduce((sum, doc) => sum + doc.items.reduce((n: number, item: any) => n + item.quantity, 0), 0);
  const total = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  return { returnedQuantity: returned, boughtBackQuantity: boughtBack, processedQuantity: returned + boughtBack, totalQuantity: total,
    status: returned && boughtBack ? (returned + boughtBack >= total ? "mixed_full" : "mixed_partial")
      : returned ? (returned >= total ? "returned" : "partially_returned")
      : boughtBack ? (boughtBack >= total ? "bought_back" : "partially_bought_back") : "none" };
}

export async function attachAfterSaleHistory(scope: RetailBranchScope, orders: any[]) {
  if (!orders.length) return orders;
  const history = await RetailAfterSaleModel.find({ ...scope, orderId: { $in: orders.map((order) => String(order._id)) } }).sort({ createdAt: -1 }).lean();
  return orders.map((order) => {
    const documents = history.filter((doc) => doc.orderId === String(order._id));
    return { ...order, afterSaleSummary: summarizeAfterSales(order, documents), afterSales: documents };
  });
}
