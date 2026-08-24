import type { RetailInvoicePaperSize } from "../interfaces/retail-settings.interface";
import type { IRetailInvoice } from "../interfaces/retail-invoice.interface";
import PDFDocument from "pdfkit";
import path from "node:path";
import { existsSync } from "node:fs";

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

export function resolveInvoiceFontPath(filename: string, exists: (candidate: string) => boolean = existsSync, cwd = process.cwd()): string {
  const candidates = [
    path.join(cwd, "server", "assets", "fonts", filename),
    path.join(cwd, "dist-server", "server", "assets", "fonts", filename),
  ];
  return candidates.find(exists) || candidates[0];
}

export interface RetailInvoicePdfResult { buffer: Buffer; filename: string }

const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const paymentLabels: Record<string, string> = { cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" };

export function invoicePdfPaymentRows(snapshot: Pick<IRetailInvoice["snapshot"], "grandTotal" | "paidAmount" | "dueAmount" | "paymentStatus" | "payments">) {
  const rows = (snapshot.payments || []).map((payment) => ({ label: paymentLabels[payment.method] || payment.method, amount: Number(payment.amount || 0) }));
  const paid = snapshot.paidAmount ?? (snapshot.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const due = snapshot.dueAmount ?? Math.max(0, Number(snapshot.grandTotal || 0) - paid);
  if (snapshot.paymentStatus === "refunded") rows.push({ label: "Đã hoàn tiền", amount: paid });
  if (due > 0) rows.push({ label: paid > 0 ? "Còn nợ" : "Ghi nợ toàn bộ", amount: due });
  const change = (snapshot.payments || []).reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0);
  if (change > 0) rows.push({ label: "Tiền thừa", amount: change });
  return rows;
}

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
  // Roboto chỉ có sẵn ký tự tiếng Việt dạng dựng sẵn (NFC), không có dấu tổ hợp (U+0302, U+031B...).
  // Dữ liệu nhập từ macOS/iOS thường ở dạng NFD nên bị mất dấu trong PDF -> chuẩn hoá mọi chuỗi về NFC.
  const writeText = doc.text.bind(doc);
  (doc as any).text = (value: unknown, ...args: unknown[]) =>
    writeText(typeof value === "string" ? value.normalize("NFC") : (value as any), ...(args as [any]));

  const regularFont = resolveInvoiceFontPath("Roboto-Regular.ttf");
  const boldFont = resolveInvoiceFontPath("Roboto-Bold.ttf");
  doc.registerFont("Roboto", regularFont);
  doc.registerFont("Roboto-Bold", boldFont);

  doc.font("Roboto-Bold");
  doc.fontSize(compact ? 13 : 18).text(invoice.snapshot.store.storeName, { align: "center" });

  doc.font("Roboto");
  doc.fontSize(compact ? 8 : 10).text(invoice.snapshot.store.legalName, { align: "center" });
  doc.text(`${invoice.snapshot.store.branchName} — ${invoice.snapshot.store.branchCode}`, { align: "center" });
  if (invoice.snapshot.store.branchAddress) doc.text(invoice.snapshot.store.branchAddress, { align: "center" });
  if (invoice.snapshot.store.branchPhone) doc.text(`Điện thoại: ${invoice.snapshot.store.branchPhone}`, { align: "center" });

  doc.font("Roboto-Bold");
  doc.moveDown().fontSize(compact ? 14 : 20).text("HÓA ĐƠN BÁN HÀNG", { align: "center" });

  doc.font("Roboto");
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
  doc.fontSize(compact ? 8 : 10).moveDown(0.5);
  for (const row of invoicePdfPaymentRows(invoice.snapshot)) doc.text(`${row.label}: ${money(row.amount)}`, { align: "right" });
  doc.fontSize(compact ? 8 : 10).text(`Bằng chữ: ${invoice.snapshot.amountInWords}`);
  doc.moveDown().text("Cảm ơn quý khách!", { align: "center" });
  doc.end();
  return { buffer: await completed, filename: invoicePdfFilename(invoice.invoiceNo) };
}
