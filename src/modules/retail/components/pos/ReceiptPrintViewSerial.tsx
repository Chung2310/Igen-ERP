import React from "react";
import { createPortal } from "react-dom";
import type { RetailInvoice, RetailSettings } from "../../types";
import { invoicePaymentRows } from "./invoicePaymentDisplay";
import { encodeCode128 } from "../../../../../shared/code128";
import { isHeadOfficeName } from "../../../../../shared/invoiceBranchDisplay";
import { BRAND_LOGO_PATH, BRAND_NAME } from "../../../../config/brand";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function ReceiptPrintView({
  invoice,
  isReprint = false,
  paperSize = "80mm",
  printTarget = false,
}: {
  invoice: RetailInvoice;
  isReprint?: boolean;
  paperSize?: RetailSettings["invoicePaperSize"];
  printTarget?: boolean;
}) {
  const snapshot = invoice.snapshot;
  const isThermal = paperSize === "80mm" || paperSize === "58mm";
  const [pageHeightMm, setPageHeightMm] = React.useState(210);
  const receiptRef = React.useRef<HTMLElement | null>(null);
  const pageRule = isThermal ? `${paperSize} ${pageHeightMm}mm` : paperSize;
  const marginRule = "0";
  const receiptWidth = isThermal ? paperSize : "100%";
  const printWidth = isThermal ? paperSize : paperSize === "A5" ? "148mm" : "210mm";
  const receiptPadding = paperSize === "58mm" ? "5mm" : paperSize === "80mm" ? "4mm" : "14mm";
  React.useLayoutEffect(() => {
    if (!isThermal || !receiptRef.current) return;
    const heightMm = receiptRef.current.getBoundingClientRect().height * 25.4 / 96;
    if (Number.isFinite(heightMm) && heightMm > 0) setPageHeightMm(Math.ceil(heightMm + 2));
  }, [invoice, isReprint, isThermal, paperSize]);
  const printCss = "@page { size: " + pageRule + "; margin: " + marginRule + "; } @media print { body.retail-print-isolated > *:not(.retail-print-staging) { display: none !important; } body.retail-print-isolated > .retail-print-staging { display: block !important; } body * { visibility: hidden !important; } .retail-print-staging { position: fixed !important; left: 0 !important; top: 0 !important; width: " + printWidth + " !important; height: auto !important; overflow: visible !important; visibility: visible !important; } #retail-receipt, #retail-receipt * { visibility: visible !important; } #retail-receipt { position: absolute; left: 0; top: 0; width: " + receiptWidth + "; max-width: 100%; padding: " + receiptPadding + "; } }";
  const barcode = encodeCode128(invoice.invoiceNo);
  const branchName = snapshot.store?.branchName?.trim() || "";
  const showBranchName = Boolean(branchName) && !isHeadOfficeName(branchName);
  const salespersonName = snapshot.salespersonName || snapshot.cashierName;

  return (
    <>
      {createPortal(<style media="print">{printCss}</style>, document.head)}
      <article ref={receiptRef} id={printTarget ? "retail-receipt" : "retail-receipt-preview"} style={isThermal ? { width: receiptWidth, maxWidth: receiptWidth, padding: receiptPadding } : undefined} className={"mx-auto w-full bg-white p-4 text-sm text-slate-900 " + (isThermal ? "max-w-sm" : "max-w-3xl")}>
      {isReprint && <p className="mb-2 text-center text-lg font-black tracking-[0.25em] text-rose-700">In lại</p>}
      <header className="border-b border-dashed pb-3 text-center">
        <div className="mb-1 flex flex-col items-center">
          <img src={BRAND_LOGO_PATH} alt="AKProAI" className="h-[14mm] w-[38mm] object-contain object-center" />
          <p className="text-base font-bold">{BRAND_NAME}</p>
        </div>
        {showBranchName && <p>{branchName}</p>}
        <h2 className="mt-2 text-lg font-bold">Hóa đơn bán hàng</h2>
        <p className="font-semibold">{invoice.invoiceNo}</p>
        <p>{new Date(invoice.issuedAt).toLocaleString("vi-VN")}</p>
      </header>
      <p className="my-3">Khách hàng: {snapshot.customerName}</p>
      <p className="-mt-2 mb-3">Nhân viên bán hàng: {salespersonName || ""}</p>
      <table className="w-full border-y border-dashed text-left">
        <thead><tr><th className="py-2">Sản phẩm</th><th>SL</th><th className="text-right">Thành tiền</th></tr></thead>
        <tbody>{snapshot.items.map((item, index) => (
          <tr key={item.productId + "-" + index}>
            <td className="py-1">
              <p>{item.productName}</p>
              {item.serialNumbers?.length ? <p className="text-xs font-semibold text-slate-600">IMEI: {item.serialNumbers.join(", ")}</p> : null}
              <p className="text-xs text-slate-500">{money(item.unitPrice)}</p>
            </td>
            <td>{item.quantity}</td>
            <td className="text-right">{money(item.lineTotal)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="space-y-1 py-3">
        <Row label="Tạm tính" value={snapshot.subtotal} />
        <Row label="Giảm giá" value={-snapshot.orderDiscount} />
        <Row label={"Thuế (" + snapshot.taxRate + "%)"} value={snapshot.taxAmount} />
        <Row label="Tổng cộng" value={snapshot.grandTotal} strong />
      </div>
      <div className="border-t border-dashed pt-2">
        {invoicePaymentRows(snapshot).map((row, index) => <Row key={row.label + "-" + index} label={row.label} value={row.amount} />)}
      </div>
      <footer className="mt-4 border-t border-dashed pt-3 text-center">
        <svg aria-label={`Barcode h\u00f3a \u0111\u01a1n ${invoice.invoiceNo}`} className="mx-auto block h-[10mm] w-full max-w-[52mm]" viewBox={`0 0 ${barcode.width} 100`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img">
          <rect width={barcode.width} height="100" fill="#fff" />
          <g fill="#000">{barcode.bars.map((bar, index) => <rect key={index} x={bar.x} y="0" width={bar.width} height="100" />)}</g>
        </svg>
        <p className="mt-1 text-[10px] font-semibold">{"Qu\u00e9t m\u00e3 ho\u1eb7c nh\u1eadp s\u1ed1 h\u00f3a \u0111\u01a1n"}</p>
        <p className="font-mono text-xs font-bold tracking-wide">{invoice.invoiceNo}</p>
      </footer>
      </article>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={"flex justify-between " + (strong ? "font-bold" : "")}><span>{label}</span><span>{money(value)}</span></div>;
}
