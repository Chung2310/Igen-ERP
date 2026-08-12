import type { ClientSession } from "mongoose";
import { RetailInvoiceCounterModel } from "../models/retail-invoice-counter.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import type { IRetailOrder } from "../interfaces/retail-order.interface";
import type { RetailBranchScope } from "../contracts";
import { buildInvoiceListQuery } from "./retail-query.service";
import type { RetailStoreSnapshot } from "../interfaces/retail-invoice.interface";
import { BranchModel } from "../../../model/branch.model";
import { CompanyModel } from "../../../model/company.model";
export { invoicePdfFilename, invoicePdfPageSize, renderRetailInvoicePdf } from "./retail-invoice-pdf.service";

export function buildRetailInvoiceSnapshot(order: any, actor: any, store: RetailStoreSnapshot) {
  return {
    store,
    customerName: order.customerName || "Khách lẻ",
    customerPhone: order.customerPhone,
    cashierName: String(actor.displayName || actor.email || ""),
    businessDate: order.businessDate,
    items: order.items.map(({ unitCost: _unitCost, category: _category, note: _note, ...item }: any) => item),
    subtotal: order.subtotal,
    orderDiscount: order.orderDiscount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    shippingFee: order.shippingFee,
    grandTotal: order.grandTotal,
    payments: (order.payments || []).map(({ method, amount, tenderedAmount, changeAmount, reference }: any) => ({ method, amount, tenderedAmount, changeAmount, reference })),
    amountInWords: `${order.grandTotal.toLocaleString("vi-VN")} đồng`,
  };
}

export async function issueRetailInvoice(order: IRetailOrder & { _id: unknown }, prefix: string, branchCode: string, scope: string, actor: any, session: ClientSession) {
  const [company, branch] = await Promise.all([
    CompanyModel.findOne({ code: order.companyCode }).session(session).lean(),
    BranchModel.findOne({ _id: order.branchId, companyCode: order.companyCode }).session(session).lean(),
  ]);
  if (!company || !branch) throw new Error("Không thể xác định thông tin cửa hàng trên hóa đơn.");
  const store: RetailStoreSnapshot = {
    legalName: company.name,
    storeName: company.name,
    branchCode: branch.code || branchCode,
    branchName: branch.name,
    branchAddress: branch.address || undefined,
    branchPhone: branch.phone || undefined,
  };
  const counter = await RetailInvoiceCounterModel.findOneAndUpdate({ companyCode: order.companyCode, branchId: order.branchId, scope }, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
  const invoiceNo = `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(counter!.seq).padStart(6, "0")}`;
  const invoice = await RetailInvoiceModel.create([{ invoiceNo, orderId: String(order._id), orderCode: order.orderCode!, companyCode: order.companyCode, branchId: order.branchId, snapshot: buildRetailInvoiceSnapshot(order, actor, store), issuedAt: new Date(), issuedBy: String(actor.id || actor.uid || ""), issuedByName: String(actor.displayName || actor.email || ""), status: "issued" }], { session });
  return invoice[0];
}

export const RetailInvoiceService = {
  async list(scope: RetailBranchScope, query: any) {
    const { filter, page, limit, skip } = buildInvoiceListQuery(scope, query);
    const [items, total] = await Promise.all([
      RetailInvoiceModel.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean(),
      RetailInvoiceModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string) {
    const invoice = await RetailInvoiceModel.findOne({ _id: id, ...scope }).lean();
    if (!invoice) throw new Error("Không tìm thấy hóa đơn.");
    return invoice;
  },
};
