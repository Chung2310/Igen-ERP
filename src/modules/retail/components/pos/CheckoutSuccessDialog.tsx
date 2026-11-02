import React from "react";
import { CheckCircle2, X } from "lucide-react";
import type { RetailOrderResult, RetailSettings } from "../../types";
import ReceiptPrintView from "./ReceiptPrintViewSerial";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function CheckoutSuccessDialog({ result, paperSize = "80mm", onNewOrder, onClose }: { result: RetailOrderResult; paperSize?: RetailSettings["invoicePaperSize"]; onNewOrder: () => void; onClose: () => void }) {
  const paid = result.order.paymentStatus === "paid";
  const title = paid ? "Thanh toán thành công" : result.order.paidAmount > 0 ? "Đã ghi nhận khoản thanh toán" : "Đơn hàng đã được lưu";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl [overflow-wrap:anywhere]">
        <div className="retail-no-print flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs text-slate-500">POS chỉ in hóa đơn này một lần.</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng kết quả" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div role="region" aria-label="Hóa đơn thanh toán" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-primary">
          <p className="text-sm text-slate-500">{result.order.orderCode}</p>
          {result.order.dueAmount > 0 && <p className="mt-1 text-sm font-semibold text-amber-700">Còn phải thu: {money(result.order.dueAmount)}</p>}
          <ReceiptPrintView invoice={result.invoice} paperSize={paperSize} />
        </div>
        <div className="retail-no-print shrink-0 border-t border-slate-100 p-4">
          <button className="w-full rounded-xl bg-[#0866f5] px-3 py-3 font-bold text-white hover:bg-[#0758d5]" onClick={onNewOrder}>Đơn mới</button>
        </div>
      </div>
    </div>
  );
}
