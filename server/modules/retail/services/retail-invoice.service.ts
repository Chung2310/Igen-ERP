import type { ClientSession } from "mongoose";
import { RetailInvoiceCounterModel } from "../models/retail-invoice-counter.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import type { IRetailOrder } from "../interfaces/retail-order.interface";

export async function issueRetailInvoice(order: IRetailOrder & { _id: unknown }, prefix: string, branchCode: string, scope: string, actor: any, session: ClientSession) {
  const counter = await RetailInvoiceCounterModel.findOneAndUpdate({ companyCode: order.companyCode, branchId: order.branchId, scope }, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
  const invoiceNo = `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(counter!.seq).padStart(6, "0")}`;
  const invoice = await RetailInvoiceModel.create([{ invoiceNo, orderId: String(order._id), orderCode: order.orderCode!, companyCode: order.companyCode, branchId: order.branchId, snapshot: { customerName: order.customerName || "Khách lẻ", customerPhone: order.customerPhone, items: order.items.map(({ unitCost: _unitCost, category: _category, note: _note, ...item }) => item), subtotal: order.subtotal, orderDiscount: order.orderDiscount, taxAmount: order.taxAmount, grandTotal: order.grandTotal, amountInWords: `${order.grandTotal.toLocaleString("vi-VN")} đồng` }, issuedAt: new Date(), issuedBy: String(actor.id || actor.uid || ""), issuedByName: String(actor.displayName || actor.email || ""), status: "issued" }], { session });
  return invoice[0];
}
