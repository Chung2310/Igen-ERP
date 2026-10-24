import React from "react";
import { CheckCircle2, Printer, X } from "lucide-react";
import type { RetailOrderResult, RetailSettings } from "../../types";
import RetailReceiptPrinter from "./RetailReceiptPrinter";

export default function CheckoutSuccessDialog({ result, paperSize = "80mm", onNewOrder, onClose }: { result: RetailOrderResult; paperSize?: RetailSettings["invoicePaperSize"]; onNewOrder: () => void; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="checkout-success-title" onClose={onClose} open={typeof HTMLDialogElement.prototype.showModal !== "function"} className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface backdrop:bg-on-surface/60">
    <div className="retail-no-print flex items-start justify-between gap-3">
      <div><CheckCircle2 className="mb-2 size-10 text-primary" aria-hidden="true" /><h2 id="checkout-success-title" className="text-balance text-xl font-bold">Thanh toán thành công</h2><p className="text-sm text-on-surface-variant">{result.order.orderCode}</p></div>
      <button type="button" aria-label="Đóng kết quả" onClick={onClose} className="min-h-11 rounded-lg border border-outline px-3 focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button>
    </div>
    <RetailReceiptPrinter invoice={result.invoice} paperSize={paperSize} />
    <div className="retail-no-print mt-4 grid grid-cols-2 gap-2"><button type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline px-3 font-bold focus-visible:outline-2 focus-visible:outline-primary" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />In hóa đơn</button><button type="button" className="min-h-11 rounded-xl bg-primary px-3 font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={onNewOrder}>Đơn mới</button></div>
  </dialog>;
}
