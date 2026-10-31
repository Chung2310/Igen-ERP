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

function drawDashedLine(doc: InstanceType<typeof PDFDocument>, x1: number, y: number, x2: number) {
  doc.save();
  doc.strokeColor("#94a3b8").lineWidth(0.6).dash(2.5, { space: 2 }).moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

/**
 * Renders a full, authentic retail receipt bill.
 */
export function renderSingleInvoiceSection(
  doc: InstanceType<typeof PDFDocument>,
  invoice: IRetailInvoice,
  compact: boolean,
  isReprint = false,
  customWidth?: number,
) {
  const startX = doc.page.margins.left;
  const contentWidth = customWidth || (doc.page.width - doc.page.margins.left - doc.page.margins.right);

  // 1. Logo & Brand info
  const logoPath = path.join(process.cwd(), "public", "brand-icon.png");
  if (fs.existsSync(logoPath)) {
    const logoW = compact ? 36 : 46;
    const logoH = compact ? 36 : 46;
    doc.image(logoPath, startX + (contentWidth - logoW) / 2, doc.y, { width: logoW, height: logoH });
    doc.y += logoH + 4;
  }

  doc.font("Roboto-Bold").fontSize(compact ? 12 : 15).fillColor("#0f172a").text(BRAND_NAME, startX, doc.y, { align: "center", width: contentWidth });

  const branchName = String(invoice.snapshot?.store?.branchName || "").trim();
  const showBranch = Boolean(branchName) && !isHeadOfficeName(branchName);
  if (showBranch) {
    doc.font("Roboto").fontSize(compact ? 7.5 : 9).fillColor("#475569").text(branchName, startX, doc.y + 2, { align: "center", width: contentWidth });
  }
  if (showBranch && invoice.snapshot?.store?.branchAddress) {
    doc.font("Roboto").fontSize(compact ? 7 : 8.5).fillColor("#64748b").text(invoice.snapshot.store.branchAddress, startX, doc.y + 1, { align: "center", width: contentWidth });
  }
  if (showBranch && invoice.snapshot?.store?.branchPhone) {
    doc.font("Roboto").fontSize(compact ? 7 : 8.5).fillColor("#64748b").text(`Hotline: ${invoice.snapshot.store.branchPhone}`, startX, doc.y + 1, { align: "center", width: contentWidth });
  }

  // Dashed divider
  doc.y += 6;
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 6;

  // 2. Receipt Title
  if (isReprint) {
    doc.font("Roboto-Bold").fontSize(compact ? 9 : 11).fillColor("#b91c1c").text("IN LẠI", startX, doc.y, { align: "center", width: contentWidth });
    doc.y += 2;
  }
  doc.font("Roboto-Bold").fontSize(compact ? 11 : 13).fillColor("#0f172a").text("HÓA ĐƠN BÁN HÀNG", startX, doc.y, { align: "center", width: contentWidth });
  doc.font("Roboto-Bold").fontSize(compact ? 8.5 : 10).fillColor("#0284c7").text(invoice.invoiceNo, startX, doc.y + 2, { align: "center", width: contentWidth });
  doc.font("Roboto").fontSize(compact ? 7 : 8.5).fillColor("#64748b").text(new Date(invoice.issuedAt).toLocaleString("vi-VN"), startX, doc.y + 1, { align: "center", width: contentWidth });

  doc.y += 6;
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 6;

  // 3. Customer & Staff info
  doc.font("Roboto").fontSize(compact ? 7.5 : 9).fillColor("#334155");
  const custName = invoice.snapshot?.customerName || "Khách lẻ";
  const custPhone = invoice.snapshot?.customerPhone ? ` - ${invoice.snapshot.customerPhone}` : "";
  doc.text(`Khách hàng: ${custName}${custPhone}`, startX, doc.y, { width: contentWidth });

  const staffName = invoice.snapshot?.salespersonName || invoice.snapshot?.cashierName || "";
  if (staffName) {
    doc.text(`Nhân viên: ${staffName}`, startX, doc.y + 2, { width: contentWidth });
  }
  if (invoice.orderCode) {
    doc.text(`Mã đơn: ${invoice.orderCode}`, startX, doc.y + 2, { width: contentWidth });
  }

  doc.y += 6;
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 5;

  // 4. Products Table
  const colQtyW = compact ? 24 : 32;
  const colPriceW = compact ? 50 : 70;
  const colTotalW = compact ? 52 : 75;
  const colNameW = contentWidth - colQtyW - colPriceW - colTotalW;

  const yHead = doc.y;
  doc.font("Roboto-Bold").fontSize(compact ? 7 : 8.5).fillColor("#0f172a");
  doc.text("Sản phẩm", startX, yHead, { width: colNameW });
  doc.text("Đ.Giá", startX + colNameW, yHead, { width: colPriceW, align: "right" });
  doc.text("SL", startX + colNameW + colPriceW, yHead, { width: colQtyW, align: "center" });
  doc.text("T.Tiền", startX + colNameW + colPriceW + colQtyW, yHead, { width: colTotalW, align: "right" });

  doc.y = yHead + (compact ? 11 : 14);
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 4;

  const items = invoice.snapshot?.items || [];
  for (const item of items) {
    const itemY = doc.y;
    doc.font("Roboto").fontSize(compact ? 7 : 8.5).fillColor("#0f172a");
    doc.text(item.productName, startX, itemY, { width: colNameW });
    const nameBottomY = doc.y;

    doc.text(money(item.unitPrice), startX + colNameW, itemY, { width: colPriceW, align: "right" });
    doc.text(String(item.quantity), startX + colNameW + colPriceW, itemY, { width: colQtyW, align: "center" });
    doc.text(money(item.lineTotal), startX + colNameW + colPriceW + colQtyW, itemY, { width: colTotalW, align: "right" });

    let nextY = Math.max(nameBottomY, itemY + (compact ? 11 : 14));

    if (item.serialNumbers?.length) {
      doc.font("Roboto").fontSize(compact ? 6.5 : 7.5).fillColor("#64748b");
      doc.text(`IMEI/Serial: ${item.serialNumbers.join(", ")}`, startX + 4, nextY, { width: contentWidth - 8 });
      nextY = doc.y;
    }
    doc.y = nextY + 3;
  }

  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 5;

  // 5. Financial Summary
  const rowH = compact ? 11 : 14;
  const drawSummaryRow = (label: string, value: string, isBold = false, color = "#0f172a", fontSize = compact ? 7.5 : 9) => {
    const curY = doc.y;
    doc.font(isBold ? "Roboto-Bold" : "Roboto").fontSize(fontSize).fillColor(color);
    doc.text(label, startX, curY, { width: contentWidth / 2 });
    doc.text(value, startX + contentWidth / 2, curY, { width: contentWidth / 2, align: "right" });
    doc.y = curY + rowH;
  };

  drawSummaryRow("Tạm tính:", money(invoice.snapshot?.subtotal || 0));
  if (invoice.snapshot?.orderDiscount) {
    drawSummaryRow("Chiết khấu / Giảm giá:", `-${money(invoice.snapshot.orderDiscount)}`);
  }
  if (invoice.snapshot?.taxAmount) {
    drawSummaryRow(`Thuế GTGT (${invoice.snapshot.taxRate}%):`, money(invoice.snapshot.taxAmount));
  }
  if (invoice.snapshot?.shippingFee) {
    drawSummaryRow("Phí vận chuyển:", money(invoice.snapshot.shippingFee));
  }

  doc.y += 2;
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 4;

  // Grand total
  drawSummaryRow("TỔNG CỘNG:", money(invoice.snapshot?.grandTotal || 0), true, "#0f172a", compact ? 9.5 : 11);

  // Payments
  const payments = invoice.snapshot?.payments || [];
  for (const p of payments) {
    const methodVi = p.method === "cash" ? "Tiền mặt" : p.method === "transfer" ? "Chuyển khoản" : p.method === "card" ? "Thẻ" : p.method;
    drawSummaryRow(`Thanh toán (${methodVi}):`, money(p.amount || 0));
  }
  const due = Number(invoice.snapshot?.dueAmount || 0);
  if (due > 0) {
    drawSummaryRow("CÒN NỢ:", money(due), true, "#dc2626");
  }

  if (invoice.snapshot?.amountInWords) {
    doc.font("Roboto").fontSize(compact ? 6.5 : 8).fillColor("#64748b").text(`Bằng chữ: ${invoice.snapshot.amountInWords}`, startX, doc.y + 2, { width: contentWidth });
    doc.y += 6;
  }

  // 6. Footer & Barcode
  doc.y += 4;
  drawDashedLine(doc, startX, doc.y, startX + contentWidth);
  doc.y += 6;

  doc.font("Roboto").fontSize(compact ? 7.5 : 9).fillColor("#475569").text("Cảm ơn quý khách & Hẹn gặp lại!", startX, doc.y, { align: "center", width: contentWidth });

  const barcode = encodeCode128(invoice.invoiceNo);
  const barcodeHeight = compact ? 24 : 28;
  const barcodeWidth = Math.min(contentWidth - 20, compact ? 140 : 160);
  const barcodeX = startX + (contentWidth - barcodeWidth) / 2;
  const barcodeY = doc.y + 4;
  const moduleW = barcodeWidth / barcode.width;

  doc.fillColor("#000000");
  for (const bar of barcode.bars) {
    doc.rect(barcodeX + bar.x * moduleW, barcodeY, bar.width * moduleW, barcodeHeight).fill();
  }
  doc.y = barcodeY + barcodeHeight + 2;
  doc.font("Roboto-Bold").fontSize(compact ? 7 : 8.5).fillColor("#0f172a").text(invoice.invoiceNo, startX, doc.y, { align: "center", width: contentWidth });
  doc.y += 10;
}

/**
 * Render single invoice PDF.
 */
export async function renderRetailInvoicePdf(
  invoice: IRetailInvoice,
  paperSize: RetailInvoicePaperSize,
  isReprint = false,
): Promise<RetailInvoicePdfResult> {
  const compact = paperSize === "80mm" || paperSize === "58mm";
  const regularFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Regular.ttf");
  const boldFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Bold.ttf");

  if (compact) {
    const pageWidth = paperSize === "58mm" ? 164.41 : 226.77;
    const doc = new PDFDocument({ autoFirstPage: false, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.once("end", () => resolve(Buffer.concat(chunks)));
      doc.once("error", reject);
    });

    const writeText = doc.text.bind(doc);
    (doc as any).text = (value: unknown, ...args: unknown[]) =>
      writeText(typeof value === "string" ? value.normalize("NFC") : (value as any), ...(args as [any]));

    doc.registerFont("Roboto", regularFont);
    doc.registerFont("Roboto-Bold", boldFont);

    doc.addPage({ size: [pageWidth, 1200], margin: 10 });
    renderSingleInvoiceSection(doc, invoice, true, isReprint, pageWidth - 20);

    const page = doc.page as any;
    const actualH = Math.max(180, Math.ceil(doc.y + 14));
    page.height = actualH;
    page.dictionary.data.MediaBox = [0, 0, page.width, actualH];

    doc.end();
    return { buffer: await completed, filename: invoicePdfFilename(invoice.invoiceNo) };
  }

  // A4 / A5 single invoice
  const doc = new PDFDocument({ autoFirstPage: false, compress: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });

  const writeText = doc.text.bind(doc);
  (doc as any).text = (value: unknown, ...args: unknown[]) =>
    writeText(typeof value === "string" ? value.normalize("NFC") : (value as any), ...(args as [any]));

  doc.registerFont("Roboto", regularFont);
  doc.registerFont("Roboto-Bold", boldFont);

  doc.addPage({ size: paperSize as any, margin: 36 });
  const cardWidth = paperSize === "A5" ? 320 : 360;
  const cardX = (doc.page.width - cardWidth) / 2;
  doc.page.margins.left = cardX;
  doc.page.margins.right = doc.page.width - cardX - cardWidth;
  doc.y = 42;

  const cardStartY = doc.y;
  renderSingleInvoiceSection(doc, invoice, false, isReprint, cardWidth);
  const cardEndY = doc.y;

  doc.save();
  doc.roundedRect(cardX - 16, cardStartY - 16, cardWidth + 32, (cardEndY - cardStartY) + 24, 8)
     .strokeColor("#cbd5e1").lineWidth(0.8).stroke();
  doc.restore();

  doc.end();
  return { buffer: await completed, filename: invoicePdfFilename(invoice.invoiceNo) };
}

/**
 * Render a sequence / chain of bills into one PDF.
 */
export async function renderBulkRetailInvoicesPdf(
  invoices: IRetailInvoice[],
  paperSize: RetailInvoicePaperSize = "A4",
  _options?: { title?: string },
): Promise<RetailInvoicePdfResult> {
  if (!invoices.length) {
    throw new Error("Không có hóa đơn nào để xuất PDF.");
  }
  const compact = paperSize === "80mm" || paperSize === "58mm";

  const regularFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Regular.ttf");
  const boldFont = path.join(process.cwd(), "server", "assets", "fonts", "Roboto-Bold.ttf");

  // 1. Thermal roll format: Each bill is a clean receipt on 80mm/58mm page
  if (compact) {
    const pageWidth = paperSize === "58mm" ? 164.41 : 226.77;
    const doc = new PDFDocument({ autoFirstPage: false, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.once("end", () => resolve(Buffer.concat(chunks)));
      doc.once("error", reject);
    });

    const writeText = doc.text.bind(doc);
    (doc as any).text = (value: unknown, ...args: unknown[]) =>
      writeText(typeof value === "string" ? value.normalize("NFC") : (value as any), ...(args as [any]));

    doc.registerFont("Roboto", regularFont);
    doc.registerFont("Roboto-Bold", boldFont);

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      doc.addPage({ size: [pageWidth, 1200], margin: 10 });
      const contentW = pageWidth - 20;
      renderSingleInvoiceSection(doc, inv, true, false, contentW);

      const page = doc.page as any;
      const actualH = Math.max(180, Math.ceil(doc.y + 14));
      page.height = actualH;
      page.dictionary.data.MediaBox = [0, 0, page.width, actualH];
    }

    doc.end();
    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      buffer: await completed,
      filename: `chuoi-hoa-don-${dateStr}.pdf`,
    };
  }

  // 2. A4 / A5 office format: Each bill is a centered receipt card with page numbers
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });

  const writeText = doc.text.bind(doc);
  (doc as any).text = (value: unknown, ...args: unknown[]) =>
    writeText(typeof value === "string" ? value.normalize("NFC") : (value as any), ...(args as [any]));

  doc.registerFont("Roboto", regularFont);
  doc.registerFont("Roboto-Bold", boldFont);

  const cardWidth = paperSize === "A5" ? 320 : 360;
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    doc.addPage({ size: paperSize as any, margin: 36 });
    const cardX = (doc.page.width - cardWidth) / 2;
    doc.page.margins.left = cardX;
    doc.page.margins.right = doc.page.width - cardX - cardWidth;
    doc.y = 42;

    const cardStartY = doc.y;
    renderSingleInvoiceSection(doc, inv, false, false, cardWidth);
    const cardEndY = doc.y;

    doc.save();
    doc.roundedRect(cardX - 16, cardStartY - 16, cardWidth + 32, (cardEndY - cardStartY) + 24, 8)
       .strokeColor("#cbd5e1").lineWidth(0.8).stroke();
    doc.restore();
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font("Roboto").fontSize(7.5).fillColor("#64748b");
    doc.text(
      `Hóa đơn ${i + 1} / ${range.count} • Mã: ${invoices[i]?.invoiceNo || ""} • ${BRAND_NAME}`,
      36,
      doc.page.height - 24,
      { width: doc.page.width - 72, align: "center", lineBreak: false },
    );
  }

  doc.end();
  const dateStr = new Date().toISOString().slice(0, 10);
  return {
    buffer: await completed,
    filename: `chuoi-hoa-don-${dateStr}.pdf`,
  };
}
