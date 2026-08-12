import type { RetailInvoicePaperSize } from "../interfaces/retail-settings.interface";
import type { IRetailInvoice } from "../interfaces/retail-invoice.interface";
import PDFDocument from "pdfkit";
import path from "node:path";

export function invoicePdfPageSize(paperSize: RetailInvoicePaperSize): "A4" | "A5" | [number, number] {
  if (paperSize === "80mm") return [226.77, 600];
  return paperSize;
}

export function invoicePdfFilename(invoiceNo: string): string {
  const safe = String(invoiceNo || "invoice")
    .replace(/[\r\n]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/^\.+/, "")
    .trim() || "invoice";
  return `${safe}.pdf`;
}

export interface RetailInvoicePdfResult { buffer: Buffer; filename: string }

const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export async function renderRetailInvoicePdf(
  invoice: IRetailInvoice,
  paperSize: RetailInvoicePaperSize,
): Promise<RetailInvoicePdfResult> {
  const compact = paperSize === "80mm";
  const doc = new PDFDocument({ size: invoicePdfPageSize(paperSize) as any, margin: compact ? 14 : 40, compress: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });
  const fontPath = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files", "noto-sans-vietnamese-400-normal.woff");
  doc.font(fontPath);
  doc.fontSize(compact ? 13 : 18).text(invoice.snapshot.store.storeName, { align: "center" });
  doc.fontSize(compact ? 8 : 10).text(invoice.snapshot.store.legalName, { align: "center" });
  doc.text(`${invoice.snapshot.store.branchName} — ${invoice.snapshot.store.branchCode}`, { align: "center" });
  if (invoice.snapshot.store.branchAddress) doc.text(invoice.snapshot.store.branchAddress, { align: "center" });
  if (invoice.snapshot.store.branchPhone) doc.text(`Điện thoại: ${invoice.snapshot.store.branchPhone}`, { align: "center" });
  doc.moveDown().fontSize(compact ? 14 : 20).text("HÓA ĐƠN BÁN HÀNG", { align: "center" });
  doc.fontSize(compact ? 8 : 10).text(`Số: ${invoice.invoiceNo}`).text(`Đơn hàng: ${invoice.orderCode}`);
  doc.text(`Khách hàng: ${invoice.snapshot.customerName || "Khách lẻ"}`).text(`Thu ngân: ${invoice.snapshot.cashierName || ""}`);
  doc.moveDown(0.5);
  for (const item of invoice.snapshot.items) {
    doc.text(`${item.productName} (${item.sku})`);
    doc.text(`${item.quantity} ${item.unit} × ${money(item.unitPrice)}  ${money(item.lineTotal)}`, { align: "right" });
  }
  doc.moveDown(0.5).text(`Tạm tính: ${money(invoice.snapshot.subtotal)}`, { align: "right" });
  if (invoice.snapshot.orderDiscount) doc.text(`Giảm giá: -${money(invoice.snapshot.orderDiscount)}`, { align: "right" });
  if (invoice.snapshot.taxAmount) doc.text(`Thuế (${invoice.snapshot.taxRate}%): ${money(invoice.snapshot.taxAmount)}`, { align: "right" });
  if (invoice.snapshot.shippingFee) doc.text(`Phí vận chuyển: ${money(invoice.snapshot.shippingFee)}`, { align: "right" });
  doc.fontSize(compact ? 11 : 14).text(`TỔNG CỘNG: ${money(invoice.snapshot.grandTotal)}`, { align: "right" });
  doc.fontSize(compact ? 8 : 10).text(`Bằng chữ: ${invoice.snapshot.amountInWords}`);
  doc.moveDown().text("Cảm ơn quý khách!", { align: "center" });
  doc.end();
  return { buffer: await completed, filename: invoicePdfFilename(invoice.invoiceNo) };
}
