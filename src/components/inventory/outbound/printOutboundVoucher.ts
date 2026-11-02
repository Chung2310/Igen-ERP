import type { Warehouse } from "../../../services/inventoryReceivingService";

export interface OutboundTicketItem {
  productId?: string;
  variantId?: string;
  sku: string;
  productName: string;
  displayName?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  unitCost?: number;
  unitIdentifiers?: string[];
  serialNumbers?: string[];
  unitDetails?: Array<{ internalBarcode?: string }>;
}

export interface OutboundTicket {
  id: string;
  refType?: string;
  refId?: string;
  reversalId?: string;
  title?: string;
  createdAt: string | number | Date;
  status?: string;
  purpose?: "bán" | "nội bộ" | "hủy" | "chuyển kho" | string;
  customerId?: string;
  customerName?: string;
  operatorName?: string;
  notes?: string;
  warehouseId?: string;
  items: OutboundTicketItem[];
}

export interface PrintOutboundVoucherOptions {
  ticket: OutboundTicket;
  warehouse?: (Warehouse & { address?: string }) | null;
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    taxCode?: string;
  };
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

export const purposeLabel = (purpose?: string): string => {
  switch (purpose) {
    case "chuyển kho":
      return "Điều chuyển kho sang cơ sở khác";
    case "nội bộ":
      return "Xuất cho nhân viên nội bộ sử dụng";
    case "hủy":
      return "Xuất hủy / lỗi / bảo hành";
    default:
      return purpose || "Xuất kho";
  }
};

/**
 * In phiếu xuất kho cách ly qua Iframe ẩn để tránh ảnh hưởng giao diện web
 */
export function printOutboundVoucher(options: PrintOutboundVoucherOptions): void {
  const { ticket, warehouse, companyInfo, includeSerials = true } = options;

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

  const dateObj = new Date(ticket.createdAt);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const timeStr = dateObj.toLocaleTimeString("vi-VN");

  const totalQuantity = ticket.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalPrice = ticket.items.reduce((sum, item) => {
    const price = item.unitPrice || item.unitCost || 0;
    return sum + (item.lineTotal || (item.quantity * price));
  }, 0);

  const rowsHtml = ticket.items.map((item, idx) => {
    const serials = (item.serialNumbers || item.unitIdentifiers || []).filter((s) => s && s.trim());

    const imeiChipsHtml = (includeSerials && serials.length > 0) ? `
      <div style="margin-top: 6px; padding: 6px 8px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px;">
        <div style="font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px;">
          Danh sách ${serials.length} mã IMEI / Serial máy xuất:
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

    const price = item.unitPrice || item.unitCost || 0;
    const lineTotal = item.lineTotal || (item.quantity * price);

    return `
      <tr>
        <td style="text-align: center; vertical-align: top; font-weight: 500;">${idx + 1}</td>
        <td style="vertical-align: top;">
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${item.productName}</div>
          ${item.displayName && item.displayName !== item.productName ? `<div style="font-size: 12px; color: #0891b2; font-weight: 600; margin-top: 2px;">${item.displayName}</div>` : ""}
          ${imeiChipsHtml}
        </td>
        <td style="font-family: Inter, sans-serif; font-size: 11px; vertical-align: top; font-weight: 600; color: #334155;">${item.sku}</td>
        <td style="text-align: center; font-size: 11px; vertical-align: top; color: #475569;">Cái</td>
        <td style="text-align: right; font-weight: 600; font-size: 13px; vertical-align: top;">${item.quantity}</td>
        <td style="text-align: right; font-family: Inter, sans-serif; font-size: 12px; vertical-align: top;">
          ${price > 0 ? money(price) : "—"}
        </td>
        <td style="text-align: right; font-weight: 600; font-family: Inter, sans-serif; font-size: 12px; vertical-align: top;">
          ${lineTotal > 0 ? money(lineTotal) : "—"}
        </td>
      </tr>
    `;
  }).join("");

  const words = totalPrice > 0 ? formatVndWords(totalPrice) : "";

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Phiếu Xuất Kho - ${ticket.id}</title>
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
        .signature-table {
          width: 100%;
          margin-top: 24px;
          border: none;
          page-break-inside: avoid;
        }
        .signature-table td {
          border: none;
          text-align: center;
          vertical-align: top;
          width: 25%;
          padding: 0 4px;
        }
        .sig-title {
          font-weight: 600;
          font-size: 12px;
          text-transform: none;
          color: #0f172a;
        }
        .sig-sub {
          font-size: 11px;
          font-style: italic;
          color: #64748b;
          margin-top: 2px;
        }
        .sig-space {
          height: 60px;
        }
        .sig-name {
          font-weight: 600;
          font-size: 12px;
          color: #0f172a;
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="vertical-align: top; width: 60%;">
            <div style="font-weight: 600; font-size: 15px; color: #0f172a;">${companyInfo?.name || "HỆ THỐNG BÁN LẺ & TRUNG TÂM THIẾT BỊ DI ĐỘNG"}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">Địa chỉ: ${companyInfo?.address || "Hồ Chí Minh, Việt Nam"}</div>
            <div style="font-size: 11px; color: #475569;">Điện thoại: ${companyInfo?.phone || "1900 xxxx"} · Hotline bảo hành</div>
          </td>
          <td style="text-align: right; vertical-align: top; width: 40%;">
            <div style="font-weight: 600; font-size: 11px; color: #334155;">Mẫu số 02 - VT</div>
            <div style="font-size: 10px; color: #64748b; font-style: italic;">(Ban hành theo Thông tư 200/2014/TT-BTC)</div>
            <div style="font-size: 11px; color: #334155; margin-top: 4px;">Số phiếu: <b style="font-family: Inter, sans-serif;">${ticket.id}</b></div>
          </td>
        </tr>
      </table>

      <div class="title-box">
        <h1 class="title-main">PHIẾU XUẤT KHO</h1>
        ${ticket.reversalId ? `<div style="font-weight: 600;color:#be123c">ĐÃ ĐẢO TOÀN BỘ — Chỉ dùng đối chiếu lịch sử</div>` : ""}
        <div class="title-sub">Ngày ${day} tháng ${month} năm ${year} (In lúc ${timeStr})</div>
        <div class="title-code">Mục đích: ${purposeLabel(ticket.purpose)}</div>
      </div>

      <div class="info-grid">
        <div>
          <span class="info-label">Xuất từ kho</span>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a;">${warehouse?.name || "Kho mặc định"}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Mã kho: <b style="font-family: Inter, sans-serif;">${warehouse?.code || "DEFAULT"}</b></div>
          ${warehouse?.address ? `<div style="font-size: 11px; color: #475569;">Địa chỉ: ${warehouse.address}</div>` : ""}
        </div>
        <div>
          <span class="info-label">${ticket.purpose === "chuyển kho" ? "Kho / Cơ sở nhận" : ticket.purpose === "nội bộ" ? "Nhân viên / Phòng ban nhận" : "Đơn vị nhận / Lý do"}</span>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
            ${ticket.customerName || (ticket.purpose === "chuyển kho" ? "Kho nhận nội bộ" : "Nhân sự nội bộ")}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Người phụ trách xuất: <b>${ticket.operatorName || "Thủ kho"}</b>
          </div>
          ${ticket.notes ? `<div style="font-size: 11px; color: #334155; margin-top: 2px; font-style: italic;">Ghi chú: ${ticket.notes}</div>` : ""}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">STT</th>
            <th>Tên hàng hóa, quy cách, phẩm chất</th>
            <th style="width: 110px; text-align: left;">Mã SKU</th>
            <th style="width: 50px; text-align: center;">ĐVT</th>
            <th style="width: 70px; text-align: right;">SL xuất</th>
            <th style="width: 90px; text-align: right;">Đơn giá</th>
            <th style="width: 105px; text-align: right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr style="background-color: #f1f5f9; font-weight: 600;">
            <td colspan="4" style="text-align: right; text-transform: none; font-size: 11px;">Tổng cộng:</td>
            <td style="text-align: right; font-size: 13px;">${totalQuantity}</td>
            <td></td>
            <td style="text-align: right; font-family: Inter, sans-serif; font-size: 13px; color: #0f172a;">
              ${totalPrice > 0 ? money(totalPrice) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      ${words ? `
        <div style="margin-bottom: 12px; font-style: italic; font-size: 11px; color: #334155;">
          Số tiền bằng chữ: <b>${words}</b>.
        </div>
      ` : ""}

      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
        Số chứng từ kèm theo: ........................................................................................................
      </div>

      <table class="signature-table">
        <tr>
          <td>
            <div class="sig-title">Người lập phiếu</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-space"></div>
            <div class="sig-name">${ticket.operatorName || ".............................."}</div>
          </td>
          <td>
            <div class="sig-title">Người nhận hàng</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-space"></div>
            <div class="sig-name">${ticket.customerName || ".............................."}</div>
          </td>
          <td>
            <div class="sig-title">Thủ kho xuất</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-space"></div>
            <div class="sig-name">..............................</div>
          </td>
          <td>
            <div class="sig-title">Kế toán trưởng</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-space"></div>
            <div class="sig-name">..............................</div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  // Đợi tài nguyên và CSS nạp xong rồi kích hoạt hộp thoại in
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 250);
}
