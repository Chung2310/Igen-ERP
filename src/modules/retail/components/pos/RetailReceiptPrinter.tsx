import React from "react";
import type { RetailInvoice, RetailSettings } from "../../types";
import ReceiptPrintView from "./ReceiptPrintViewSerial";

export default function RetailReceiptPrinter({ invoice, paperSize }: {
  invoice: RetailInvoice;
  paperSize: RetailSettings["invoicePaperSize"];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [heightMm, setHeightMm] = React.useState(210);
  const thermal = paperSize === "58mm" || paperSize === "80mm";
  const width = thermal ? paperSize : paperSize === "A5" ? "148mm" : "210mm";
  const padding = paperSize === "58mm" ? "5mm" : paperSize === "80mm" ? "4mm" : "14mm";

  React.useLayoutEffect(() => {
    if (!thermal) return;
    const receipt = containerRef.current?.querySelector<HTMLElement>("#retail-receipt");
    if (!receipt) return;
    const measure = () => {
      const measured = receipt.getBoundingClientRect().height * 25.4 / 96;
      if (Number.isFinite(measured) && measured > 0) setHeightMm(Math.ceil(measured + 2));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(receipt);
    return () => observer.disconnect();
  }, [invoice, paperSize, thermal]);

  return <div ref={containerRef} data-paper-size={paperSize} className="retail-receipt-printer">
    <ReceiptPrintView invoice={invoice} />
    <style>{`
      .retail-receipt-printer #retail-receipt { box-sizing: border-box; width: ${width}; max-width: 100%; }
      @page { size: ${thermal ? `${paperSize} ${heightMm}mm` : paperSize}; margin: 0; }
      @media print {
        .retail-receipt-printer #retail-receipt {
          box-sizing: border-box; position: absolute; left: 0; top: 0;
          width: ${width} !important; max-width: none !important;
          padding: ${padding} !important; margin: 0 !important;
        }
        .retail-no-print { display: none !important; }
      }
    `}</style>
  </div>;
}
