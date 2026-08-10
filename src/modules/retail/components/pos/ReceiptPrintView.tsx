import React from "react";
import type { RetailInvoice } from "../../types";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const paymentLabel: Record<string, string> = { cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" };

export default function ReceiptPrintView({ invoice }: { invoice: RetailInvoice }) {
  const snapshot = invoice.snapshot;
  return <article id="retail-receipt" className="mx-auto w-full max-w-sm bg-white p-4 text-sm text-slate-900">
    <style>{`@media print { body * { visibility: hidden !important; } #retail-receipt, #retail-receipt * { visibility: visible !important; } #retail-receipt { position: absolute; left: 0; top: 0; width: 80mm; max-width: 100%; padding: 4mm; } .retail-no-print { display: none !important; } }`}</style>
    <header className="border-b border-dashed pb-3 text-center"><h2 className="text-lg font-bold">HÓA ĐƠN BÁN HÀNG</h2><p className="font-semibold">{invoice.invoiceNo}</p><p>{new Date(invoice.issuedAt).toLocaleString("vi-VN")}</p></header>
    <dl className="my-3 grid grid-cols-[90px_1fr] gap-1"><dt>Khách hàng</dt><dd>{snapshot.customerName}</dd>{snapshot.customerPhone && <><dt>Điện thoại</dt><dd>{snapshot.customerPhone}</dd></>}<dt>Thu ngân</dt><dd>{snapshot.cashierName}</dd>{snapshot.businessDate && <><dt>Ngày bán</dt><dd>{snapshot.businessDate}</dd></>}</dl>
    <table className="w-full border-y border-dashed text-left"><thead><tr><th className="py-2">Sản phẩm</th><th>SL</th><th className="text-right">Thành tiền</th></tr></thead><tbody>{snapshot.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td className="py-1"><p>{item.productName}</p><p className="text-xs text-slate-500">{money(item.unitPrice)}{item.discountAmount ? ` · Giảm ${money(item.discountAmount)}` : ""}</p></td><td>{item.quantity}</td><td className="text-right">{money(item.lineTotal)}</td></tr>)}</tbody></table>
    <div className="space-y-1 py-3"><Row label="Tạm tính" value={snapshot.subtotal} /><Row label="Giảm giá đơn" value={-snapshot.orderDiscount} /><Row label={`Thuế (${snapshot.taxRate}%)`} value={snapshot.taxAmount} /><Row label="Phí vận chuyển" value={snapshot.shippingFee} /><Row label="Tổng cộng" value={snapshot.grandTotal} strong /></div>
    <div className="border-t border-dashed pt-2">{snapshot.payments.map((payment, index) => <Row key={index} label={paymentLabel[payment.method] || payment.method} value={payment.amount} />)}{snapshot.payments.reduce((sum, payment) => sum + (payment.changeAmount || 0), 0) > 0 && <Row label="Tiền thừa" value={snapshot.payments.reduce((sum, payment) => sum + (payment.changeAmount || 0), 0)} />}</div>
    <p className="mt-4 text-center text-xs">Cảm ơn quý khách!</p>
  </article>;
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "text-base font-bold" : ""}`}><span>{label}</span><span>{money(value)}</span></div>; }
