import type { RetailInvoicePaperSize } from "../interfaces/retail-settings.interface";
import type { IRetailInvoice } from "../interfaces/retail-invoice.interface";
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import { encodeCode128 } from "../../../../shared/code128";
import { isHeadOfficeName } from "../../../../shared/invoiceBranchDisplay";
import { BRAND_NAME } from "../../../../src/config/brand";

export function invoicePdfPageSize(paperSize: RetailInvoicePaperSize): "A4" | "A5" | [number, number] {
  if (paperSize === "58mm") return [164.41, 600];
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
  isReprint = false,
): Promise<RetailInvoicePdfResult> {
  const compact = paperSize === "80mm" || paperSize === "58mm";
  const pageSize = invoicePdfPageSize(paperSize);
  if (compact && Array.isArray(pageSize)) pageSize[1] = 12_000;
  const doc = new PDFDocument({ size: pageSize as any, margin: compact ? 14 : 40, compress: true });
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

  const regularFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Regular.ttf");
  const boldFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Bold.ttf");
  doc.registerFont("Roboto", regularFont);
  doc.registerFont("Roboto-Bold", boldFont);

  doc.font("Roboto-Bold");
  const logoPath = path.join(process.cwd(), "public", "brand-icon.png");
  if (fs.existsSync(logoPath)) {
    const logoWidth = compact ? 108 : 128;
    const logoHeight = compact ? 42 : 48;
    doc.image(logoPath, (doc.page.width - logoWidth) / 2, doc.y, {
      cover: [logoWidth, logoHeight],
      align: "center",
      valign: "center",
    });
    doc.y += logoHeight;
  }
  doc.fontSize(compact ? 13 : 18).text(BRAND_NAME, { align: "center" });

  doc.font("Roboto");
  const branchName = String(invoice.snapshot.store.branchName || "").trim();
  const showBranchInfo = Boolean(branchName) && !isHeadOfficeName(branchName);
  if (showBranchInfo) doc.text(branchName, { align: "center" });
  if (showBranchInfo && invoice.snapshot.store.branchAddress) doc.text(invoice.snapshot.store.branchAddress, { align: "center" });
  if (showBranchInfo && invoice.snapshot.store.branchPhone) doc.text(`Điện thoại: ${invoice.snapshot.store.branchPhone}`, { align: "center" });

  doc.font("Roboto-Bold");
  doc.moveDown().fontSize(compact ? 14 : 20).text("HÓA ĐƠN BÁN HÀNG", { align: "center" });
  if (isReprint) {
    doc.moveDown(0.25).font("Roboto-Bold").fillColor("#b91c1c").fontSize(compact ? 12 : 16).text("IN LẠI", { align: "center" }).fillColor("#000000");
  }

  doc.font("Roboto");
  doc.fontSize(compact ? 8 : 10).text(`Số: ${invoice.invoiceNo}`).text(`Đơn hàng: ${invoice.orderCode}`);
  doc.text(`Khách hàng: ${invoice.snapshot.customerName || "Khách lẻ"}`).text(`Nhân viên bán hàng: ${invoice.snapshot.salespersonName || invoice.snapshot.cashierName || ""}`);
  doc.moveDown(0.5);
  for (const item of invoice.snapshot.items) {
    doc.text(`${item.productName} (${item.sku})`);
    doc.text(`${item.quantity} ${item.unit} × ${money(item.unitPrice)}  ${money(item.lineTotal)}`, { align: "right" });
  }
  doc.moveDown(0.5).text(`Tạm tính: ${money(invoice.snapshot.subtotal)}`, { align: "right" });
  if (invoice.snapshot.orderDiscount) doc.text(`Giảm giá: -${money(invoice.snapshot.orderDiscount)}`, { align: "right" });
  doc.text(`Thuế (${invoice.snapshot.taxRate}%): ${money(invoice.snapshot.taxAmount)}`, { align: "right" });
  if (invoice.snapshot.shippingFee) doc.text(`Phí vận chuyển: ${money(invoice.snapshot.shippingFee)}`, { align: "right" });
  doc.fontSize(compact ? 11 : 14).text(`TỔNG CỘNG: ${money(invoice.snapshot.grandTotal)}`, { align: "right" });
  doc.fontSize(compact ? 8 : 10).moveDown(0.5);
  for (const row of invoicePdfPaymentRows(invoice.snapshot)) doc.text(`${row.label}: ${money(row.amount)}`, { align: "right" });
  doc.fontSize(compact ? 8 : 10).text(`Bằng chữ: ${invoice.snapshot.amountInWords}`);
  doc.moveDown().text("Cảm ơn quý khách!", { align: "center" });
  doc.moveDown(0.5).fontSize(compact ? 8 : 10).text("Quét mã hoặc nhập số hóa đơn", { align: "center" });
  const barcode = encodeCode128(invoice.invoiceNo);
  const barcodeHeight = compact ? 28 : 36;
  const barcodeWidth = Math.min(doc.page.width - doc.page.margins.left - doc.page.margins.right, compact ? 156 : 170);
  if (!compact && doc.y + barcodeHeight + 22 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const barcodeY = doc.y + 2;
  const barcodeX = (doc.page.width - barcodeWidth) / 2;
  const moduleWidth = barcodeWidth / barcode.width;
  doc.fillColor("#000000");
  for (const bar of barcode.bars) {
    doc.rect(barcodeX + bar.x * moduleWidth, barcodeY, bar.width * moduleWidth, barcodeHeight).fill();
  }
  doc.y = barcodeY + barcodeHeight + 3;
  doc.font("Roboto-Bold").fontSize(compact ? 8 : 10).text(invoice.invoiceNo, { align: "center" });
  if (compact) {
    const page = doc.page as any;
    const contentHeight = Math.ceil(doc.y + page.margins.bottom);
    page.height = contentHeight;
    page.dictionary.data.MediaBox = [0, 0, page.width, contentHeight];
  }
  doc.end();
  return { buffer: await completed, filename: invoicePdfFilename(invoice.invoiceNo) };
}
