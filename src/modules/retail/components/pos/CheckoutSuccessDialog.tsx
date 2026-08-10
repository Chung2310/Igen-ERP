import React from "react";
import { CheckCircle2, Printer, X } from "lucide-react";
import type { RetailOrderResult } from "../../types";
import ReceiptPrintView from "./ReceiptPrintView";

export default function CheckoutSuccessDialog({ result, onNewOrder, onClose }: { result: RetailOrderResult; onNewOrder: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4"><div role="dialog" aria-label="Thanh toán thành công" className="mx-auto max-w-lg rounded-3xl bg-white p-5"><div className="retail-no-print flex items-start justify-between"><div><CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" /><h2 className="text-xl font-bold">Thanh toán thành công</h2><p className="text-sm text-slate-500">{result.order.orderCode}</p></div><button aria-label="Đóng kết quả" onClick={onClose}><X /></button></div><ReceiptPrintView invoice={result.invoice} /><div className="retail-no-print mt-4 grid grid-cols-2 gap-2"><button className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-bold" onClick={() => window.print()}><Printer className="h-4 w-4" />In hóa đơn</button><button className="rounded-xl bg-cyan-600 px-3 py-3 font-bold text-white" onClick={onNewOrder}>Đơn mới</button></div></div></div>;
}
