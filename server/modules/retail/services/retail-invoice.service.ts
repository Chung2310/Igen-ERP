import type { ClientSession } from "mongoose";
import { RetailInvoiceCounterModel } from "../models/retail-invoice-counter.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import type { IRetailOrder } from "../interfaces/retail-order.interface";
import type { RetailBranchScope } from "../contracts";
import { buildInvoiceListQuery } from "./retail-query.service";
import type { RetailStoreSnapshot } from "../interfaces/retail-invoice.interface";
import { BranchModel } from "../../../model/branch.model";
import { CompanyModel } from "../../../model/company.model";
import { UserModel } from "../../../model/user.model";
export { invoicePdfFilename, invoicePdfPageSize, invoicePdfPaymentRows, renderRetailInvoicePdf } from "./retail-invoice-pdf.service";

export function buildRetailInvoiceSnapshot(order: any, actor: any, store: RetailStoreSnapshot) {
  const vndValues = [order.grandTotal, order.paidAmount, order.dueAmount, ...(order.payments || []).map((payment: any) => payment.amount)];
  if (vndValues.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 0)) throw new Error("INVALID_INVOICE_VND");
  if (order.paymentStatus !== "refunded" && Number(order.paidAmount) + Number(order.dueAmount) !== Number(order.grandTotal)) throw new Error("INVALID_INVOICE_PAYMENT_TOTAL");
  return {
    store,
    customerName: order.customerName || "Khách lẻ",
    customerPhone: order.customerPhone,
    customerSnapshot: order.customerSnapshot,
    billingSnapshot: order.billingSnapshot,
    cashierName: String(actor.displayName || actor.email || ""),
    businessDate: order.businessDate,
    items: order.items.map(({ unitCost: _unitCost, category: _category, note: _note, ...item }: any) => item),
    subtotal: order.subtotal,
    orderDiscount: order.orderDiscount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    shippingFee: order.shippingFee,
    grandTotal: order.grandTotal,
    paidAmount: order.paidAmount,
    dueAmount: order.dueAmount,
    paymentStatus: order.paymentStatus,
    payments: (order.payments || []).map(({ method, amount, tenderedAmount, changeAmount, reference }: any) => ({ method, amount, tenderedAmount, changeAmount, reference })),
    amountInWords: `${order.grandTotal.toLocaleString("vi-VN")} đồng`,
  };
}

const emailLike = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
export function projectLegacyInvoiceCashier(invoice: any, displayName?: string) {
  if (!displayName || !emailLike(invoice?.snapshot?.cashierName)) return invoice;
  return { ...invoice, issuedByName: displayName, snapshot: { ...invoice.snapshot, cashierName: displayName } };
}

async function projectInvoiceCashiers(invoices: any[]) {
  const legacy = invoices.filter((invoice) => emailLike(invoice?.snapshot?.cashierName) && invoice.issuedBy);
  if (!legacy.length) return invoices;
  const users = await UserModel.find({ _id: { $in: [...new Set(legacy.map((invoice) => String(invoice.issuedBy)))] } }).select("displayName").lean();
  const names = new Map(users.map((user: any) => [String(user._id), String(user.displayName || "").trim()]));
  return invoices.map((invoice) => projectLegacyInvoiceCashier(invoice, names.get(String(invoice.issuedBy))));
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
    return { items: await projectInvoiceCashiers(items), total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string) {
    const invoice = await RetailInvoiceModel.findOne({ _id: id, ...scope }).lean();
    if (!invoice) throw new Error("Không tìm thấy hóa đơn.");
    return (await projectInvoiceCashiers([invoice]))[0];
  },
};
