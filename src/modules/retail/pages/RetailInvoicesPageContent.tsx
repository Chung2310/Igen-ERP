import React from "react";
import { Download, Eye, Printer, X } from "lucide-react";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import ReceiptPrintView from "../components/pos/ReceiptPrintView";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailInvoice } from "../types";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailInvoicesPageContent() {
  const { scope } = useRetailScope();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [items, setItems] = React.useState<RetailInvoice[]>([]);
  const [selected, setSelected] = React.useState<RetailInvoice | null>(null);
  const [downloadingId, setDownloadingId] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!scope) return;
    const timer = setTimeout(() => void retailInvoicesApi.list(scope, { q, status: status || undefined })
      .then((data) => setItems(data.items))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được hóa đơn.")), 250);
    return () => clearTimeout(timer);
  }, [scope?.companyCode, scope?.branchId, q, status]);

  if (!scope) return <div>Vui lòng chọn chi nhánh.</div>;

  const detail = async (id: string) => {
    try {
      const invoice = await retailInvoicesApi.detail(scope, id);
      setSelected(invoice);
      return invoice;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được hóa đơn.");
      return null;
    }
  };
  const reprint = async (id: string) => {
    const invoice = await detail(id);
    if (invoice) setTimeout(() => window.print(), 0);
  };
  const download = async (id: string) => {
    setDownloadingId(id);
    setError("");
    try { await retailInvoicesApi.downloadPdf(scope, id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được PDF hóa đơn."); }
    finally { setDownloadingId(""); }
  };

  return <section className="space-y-4">
    <header><h1 className="text-xl font-bold">Hóa đơn nội bộ</h1><p className="text-sm text-slate-500">Snapshot bất biến; có thể xem, in lại hoặc tải PDF mà không tạo giao dịch mới.</p></header>
    <div className="grid gap-3 sm:grid-cols-[1fr_200px]"><input aria-label="Tìm hóa đơn" className="rounded-xl border px-3 py-2" placeholder="Số hóa đơn, mã đơn, khách hàng" value={q} onChange={(event) => setQ(event.target.value)} /><select aria-label="Trạng thái hóa đơn" className="rounded-xl border px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả</option><option value="issued">Đã phát hành</option><option value="void">Đã vô hiệu</option></select></div>
    {error && <p className="text-red-600">{error}</p>}
    <div className="grid gap-3">{items.map((invoice) => <article key={invoice._id} className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{invoice.invoiceNo}</p><p className="text-sm text-slate-500">{invoice.orderCode} · {invoice.snapshot.customerName}</p></div><div className="flex items-center gap-2"><div className="mr-2 text-right"><p className="font-bold">{money(invoice.snapshot.grandTotal)}</p><p className="text-xs uppercase">{invoice.status}</p></div><button aria-label={`Xem hóa đơn ${invoice.invoiceNo}`} className="rounded-xl border p-2" onClick={() => void detail(invoice._id)}><Eye className="h-4 w-4" /></button><button aria-label={`In lại hóa đơn ${invoice.invoiceNo}`} className="rounded-xl border p-2" onClick={() => void reprint(invoice._id)}><Printer className="h-4 w-4" /></button><button aria-label={`Tải PDF hóa đơn ${invoice.invoiceNo}`} disabled={downloadingId === invoice._id} className="rounded-xl border p-2 disabled:opacity-50" onClick={() => void download(invoice._id)}><Download className="h-4 w-4" /></button></div></div></article>)}</div>
    {selected && <InvoiceDialog invoice={selected} downloading={downloadingId === selected._id} onDownload={() => void download(selected._id)} onClose={() => setSelected(null)} />}
  </section>;
}

function InvoiceDialog({ invoice, downloading, onDownload, onClose }: { invoice: RetailInvoice; downloading: boolean; onDownload: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"><div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{invoice.invoiceNo}</h2><p className="text-sm text-slate-500">{invoice.orderCode} · {invoice.snapshot.customerName}</p></div><div className="flex items-center gap-2"><button aria-label="Tải PDF hóa đơn" disabled={downloading} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50" onClick={onDownload}><Download className="h-4 w-4" />PDF</button><button aria-label="In hóa đơn" className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" onClick={() => window.print()}><Printer className="h-4 w-4" />In</button><button aria-label="Đóng hóa đơn" onClick={onClose}><X /></button></div></div><div className="mt-5 space-y-2">{invoice.snapshot.items.map((item) => <div key={`${item.productId}-${item.sku}`} className="flex justify-between border-b py-2"><span>{item.productName} × {item.quantity}</span><b>{money(item.lineTotal)}</b></div>)}</div><div className="mt-4 space-y-2 text-sm"><Row label="Tạm tính" value={invoice.snapshot.subtotal} /><Row label="Giảm giá" value={invoice.snapshot.orderDiscount} /><Row label="Thuế" value={invoice.snapshot.taxAmount} /><Row label="Tổng cộng" value={invoice.snapshot.grandTotal} strong /></div><p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Bằng chữ: {invoice.snapshot.amountInWords}</p><div className="hidden print:block"><ReceiptPrintView invoice={invoice} /></div></div></div>;
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "text-base font-bold" : ""}`}><span>{label}</span><span>{money(value)}</span></div>; }
