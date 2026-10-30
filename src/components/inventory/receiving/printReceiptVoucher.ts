import type { GoodsReceipt, Supplier, Warehouse } from "../../../services/inventoryReceivingService";
import type { CatalogProductDetail } from "../../../services/productCatalogService";

export interface PrintReceiptVoucherOptions {
  receipt: GoodsReceipt;
  supplier?: Supplier;
  warehouse?: Warehouse;
  productDetails?: Record<string, CatalogProductDetail>;
  includeSerials?: boolean;
}

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

/**
 * Đọc số tiền thành chữ tiếng Việt chuẩn kế toán
 */
export function formatVndWords(amount: number): string {
  if (!amount || amount <= 0) return "Không đồng";
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  function readTriple(n: number, isLast: boolean): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    let res = "";

    if (h > 0 || !isLast) {
      res += units[h] + " trăm ";
    }
    if (t > 1) {
      res += units[t] + " mươi ";
      if (u === 1) res += "mốt ";
      else if (u === 5) res += "lăm ";
      else if (u > 0) res += units[u] + " ";
    } else if (t === 1) {
      res += "mười ";
      if (u === 5) res += "lăm ";
      else if (u > 0) res += units[u] + " ";
    } else if (t === 0 && u > 0) {
      if (h > 0 || !isLast) res += "lẻ ";
      res += units[u] + " ";
    }
    return res.trim();
  }

  const parts: number[] = [];
  let temp = Math.floor(amount);
  while (temp > 0) {
    parts.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let words = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const val = parts[i];
    if (val > 0) {
      const isLast = i === parts.length - 1;
      const tripleStr = readTriple(val, isLast);
      words += tripleStr + " " + scales[i] + " ";
    }
  }

  words = words.trim();
  if (!words) return "Không đồng";
  return words.charAt(0).toUpperCase() + words.slice(1) + " đồng chẵn";
}

/**
 * In phiếu nhập kho cách ly qua Iframe để tránh đè giao diện web
 */
export function printReceiptVoucher(options: PrintReceiptVoucherOptions): void {
  const { receipt, supplier, warehouse, productDetails = {}, includeSerials = true } = options;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const dateObj = new Date(receipt.createdAt);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const timeStr = dateObj.toLocaleTimeString("vi-VN");

  const totalQuantity = receipt.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const statusLabel = {
    draft: "Bản nháp",
    pending: "Chờ xác nhận",
    receiving: "Đang nhập kho",
    confirmed: "Hoàn thành",
    cancelled: "Đã hủy",
  }[receipt.status] || receipt.status;

  const rowsHtml = receipt.items.map((item, idx) => {
    const detail = productDetails[item.productId];
    const variant = detail?.variants.find((v) => v._id === item.variantId || v.sku === item.sku);
    const displayVariantName = item.displayName || variant?.displayName;
    const serials = (item.serialNumbers || []).filter((s) => s && s.trim());

    const imeiChipsHtml = (includeSerials && serials.length > 0) ? `
      <div style="margin-top: 6px; padding: 6px 8px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px;">
        <div style="font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px;">
          Danh sách ${serials.length} mã IMEI / Serial máy:
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; font-family: Inter, sans-serif; font-size: 10px; color: #1e293b;">
          ${serials.map((s, sIdx) => {
            const nb = item.unitDetails?.[sIdx]?.internalBarcode;
            return `<div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 2px 4px; border-radius: 3px;">
              <span style="color: #94a3b8; font-family: Inter, sans-serif;">#${sIdx + 1}</span> <b>${s}</b>
              ${nb ? `<br/><span style="color: #64748b; font-size: 9px;">NB: ${nb}</span>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>
    ` : "";

    const lineTotal = item.lineTotal || (item.quantity * item.unitCost);

    return `
      <tr>
        <td style="text-align: center; vertical-align: top; font-weight: 500;">${idx + 1}</td>
        <td style="vertical-align: top;">
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${item.productName}</div>
          ${displayVariantName ? `<div style="font-size: 12px; color: #0891b2; font-weight: 600; margin-top: 2px;">${displayVariantName}</div>` : ""}
          ${item.barcode ? `<div style="font-size: 10px; color: #64748b; font-family: Inter, sans-serif; margin-top: 1px;">Mã vạch: ${item.barcode}</div>` : ""}
          ${imeiChipsHtml}
        </td>
        <td style="font-family: Inter, sans-serif; font-size: 11px; vertical-align: top; font-weight: 600; color: #334155;">${item.sku}</td>
        <td style="text-align: center; font-size: 11px; vertical-align: top;">
          ${item.trackingMode === "serial" ? '<span style="font-weight: 600; color: #6b21a8;">IMEI / Serial</span>' : "Số lượng"}
        </td>
        <td style="text-align: right; font-weight: 600; font-size: 13px; vertical-align: top;">${item.quantity}</td>
        <td style="text-align: center; font-size: 11px; vertical-align: top; color: #475569;">
          ${item.supplierWarrantyMonths ? `${item.supplierWarrantyMonths} th` : "—"}
        </td>
        <td style="text-align: right; font-family: Inter, sans-serif; font-size: 12px; vertical-align: top;">
          ${money(item.unitCost)}
        </td>
        <td style="text-align: right; font-weight: 600; font-family: Inter, sans-serif; font-size: 12px; vertical-align: top;">
          ${money(lineTotal)}
        </td>
      </tr>
    `;
  }).join("");

  const words = formatVndWords(receipt.subtotal);

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Phiếu Nhập Kho - ${receipt.receiptCode}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900;1,100..900&display=swap');
        @page {
          size: A4 portrait;
          margin: 12mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: Inter, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.45;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border: none;
          margin-bottom: 8px;
        }
        .header-table td {
          border: none;
          padding: 0;
        }
        .title-box {
          text-align: center;
          margin: 12px 0 16px 0;
        }
        .title-main {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: none;
          margin: 0;
          color: #0f172a;
        }
        .title-sub {
          font-size: 12px;
          font-style: italic;
          color: #475569;
          margin-top: 3px;
        }
        .title-code {
          font-size: 13px;
          font-weight: 600;
          margin-top: 4px;
          color: #0f172a;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #f8fafc;
        }
        .info-label {
          color: #64748b;
          font-size: 10px;
          text-transform: none;
          font-weight: 600;
          letter-spacing: 0.3px;
          display: block;
          margin-bottom: 2px;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        table.items-table th, table.items-table td {
          border: 1px solid #94a3b8;
          padding: 6px 8px;
        }
        table.items-table th {
          background-color: #e2e8f0;
          font-size: 11px;
          text-transform: none;
          font-weight: 600;
          color: #1e293b;
        }
        .total-box {
          border: 1px solid #94a3b8;
          background-color: #f8fafc;
          padding: 10px 14px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          text-align: center;
          margin-top: 16px;
          page-break-inside: avoid;
        }
        .sig-title {
          font-weight: 600;
          font-size: 12px;
          color: #0f172a;
        }
        .sig-desc {
          font-size: 10px;
          color: #64748b;
          font-style: italic;
          margin-top: 1px;
          margin-bottom: 64px;
        }
        .sig-name {
          font-weight: 600;
          font-size: 11px;
          color: #0f172a;
        }
      </style>
    </head>
    <body>
      <!-- Top Meta -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: top; width: 62%;">
            <div style="font-weight: 600; font-size: 13px; text-transform: none; color: #0f172a;">
              HỆ THỐNG CỬA HÀNG ĐIỆN THOẠI & THIẾT BỊ DI ĐỘNG
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              Kho nhập: <b>${warehouse?.name || "Kho bán hàng - Trụ sở chính"}</b>
            </div>
            ${warehouse?.code ? `<div style="font-size: 11px; color: #475569;">Mã kho: <b>${warehouse.code}</b> · Loại kho: ${warehouse.kind === "central" ? "Kho trung tâm" : "Kho bán hàng"}</div>` : ""}
          </td>
          <td style="vertical-align: top; text-align: right; width: 38%;">
            <div style="font-size: 11px; font-weight: 600; color: #1e293b;">Mẫu số: 01 - VT</div>
            <div style="font-size: 10px; color: #64748b; font-style: italic;">(Ban hành theo TT 200/2014/TT-BTC)</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              Trạng thái: <b>${statusLabel}</b>
            </div>
          </td>
        </tr>
      </table>

      <!-- Title -->
      <div class="title-box">
        <h1 class="title-main">PHIẾU NHẬP KHO</h1>
        <div class="title-sub">Ngày ${day} tháng ${month} năm ${year} (lúc ${timeStr})</div>
        <div class="title-code">
          Số chứng từ: <span style="font-family: Inter, sans-serif; font-size: 14px;">${receipt.receiptCode}</span>
        </div>
      </div>

      <!-- Info Details -->
      <div class="info-grid">
        <div>
          <span class="info-label">Đơn vị giao hàng / Nhà cung cấp</span>
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${receipt.supplierName || "—"}</div>
          ${supplier?.code ? `<div style="font-size: 11px; color: #475569;">Mã NCC: <span style="font-family: Inter, sans-serif; font-weight: 600;">${supplier.code}</span></div>` : ""}
          ${supplier?.phone ? `<div style="font-size: 11px; color: #475569;">Điện thoại: <b>${supplier.phone}</b></div>` : ""}
          ${supplier?.address ? `<div style="font-size: 11px; color: #475569;">Địa chỉ: ${supplier.address}</div>` : ""}
          ${supplier?.taxCode ? `<div style="font-size: 11px; color: #475569;">Mã số thuế: ${supplier.taxCode}</div>` : ""}
        </div>
        <div>
          <span class="info-label">Thông tin tiếp nhận kho</span>
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${warehouse?.name || "Kho tiếp nhận chính"}</div>
          <div style="font-size: 11px; color: #475569;">Người lập phiếu: <b>${receipt.createdByName || receipt.createdBy || "Nhân viên kho"}</b></div>
          ${(receipt as any).confirmedByName ? `<div style="font-size: 11px; color: #047857;">Người duyệt nhập: <b>${(receipt as any).confirmedByName}</b></div>` : ""}
          ${receipt.receivedAt ? `<div style="font-size: 11px; color: #475569;">Thời điểm nhập kho: ${new Date(receipt.receivedAt).toLocaleString("vi-VN")}</div>` : ""}
        </div>
        <div style="grid-column: span 2; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 2px;">
          <span class="info-label">Ghi chú phiếu nhập</span>
          <div style="font-size: 11px; color: #1e293b;">${receipt.notes || "Không có ghi chú thêm."}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">STT</th>
            <th>Tên sản phẩm, quy cách phẩm chất</th>
            <th style="width: 120px;">Mã SKU</th>
            <th style="width: 80px; text-align: center;">Hình thức</th>
            <th style="width: 48px; text-align: right;">SL</th>
            <th style="width: 55px; text-align: center;">BH NCC</th>
            <th style="width: 95px; text-align: right;">Đơn giá</th>
            <th style="width: 110px; text-align: right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Summary Box -->
      <div class="total-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-size: 12px; color: #334155;">
            Số dòng mặt hàng: <b>${receipt.items.length} SKU</b> &nbsp;·&nbsp;
            Tổng số lượng nhập kho: <b style="font-size: 13px; color: #0f172a;">${totalQuantity} máy</b>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
            Tổng tiền hàng: <span style="font-size: 16px; font-weight: 600; color: #047857; margin-left: 6px; font-family: Inter, sans-serif;">${money(receipt.subtotal)}</span>
          </div>
        </div>
        <div style="font-size: 11px; color: #475569; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
          Số tiền viết bằng chữ: <b>${words}</b>
        </div>
      </div>

      <!-- Signatures -->
      <div class="signatures">
        <div>
          <div class="sig-title">Người lập phiếu</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
          <div class="sig-name">${receipt.createdByName || receipt.createdBy || ""}</div>
        </div>
        <div>
          <div class="sig-title">Người giao hàng</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
          <div class="sig-name">${receipt.supplierName || ""}</div>
        </div>
        <div>
          <div class="sig-title">Thủ kho nhận</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div class="sig-title">Kế toán trưởng / Duyệt</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
        </div>
      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  // Print once DOM is fully rendered in the iframe
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Ignore print cancel errors
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}
