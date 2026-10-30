import type { InventoryCount } from "../../services/inventoryCountService";

export interface PrintInventoryCountOptions {
  count: InventoryCount;
  warehouseName?: string;
}

export function printInventoryCountVoucher(options: PrintInventoryCountOptions): void {
  const { count, warehouseName } = options;

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

  const dateObj = new Date(count.createdAt);
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const timeStr = dateObj.toLocaleTimeString("vi-VN");

  const statusLabel = {
    draft: "Bản nháp",
    counting: "Đang kiểm đếm",
    pending_approval: "Chờ duyệt cân bằng",
    completed: "Đã hoàn thành cân bằng kho",
    cancelled: "Đã hủy",
    conflict: "Xung đột tồn kho",
  }[count.status] || count.status;

  const totalSystemQty = count.items.reduce((sum, item) => sum + item.systemQuantity, 0);
  const totalCountedQty = count.items.reduce((sum, item) => sum + item.countedQuantity, 0);
  const totalDelta = count.items.reduce((sum, item) => sum + item.quantityDelta, 0);

  const rowsHtml = count.items.map((item, idx) => {
    const isMatched = item.quantityDelta === 0;
    const isShortage = item.quantityDelta < 0;
    const tracking = item.trackingMode === "serial" ? "IMEI / Serial" : item.trackingMode === "unit_barcode" ? "Mã vạch đơn vị" : "Số lượng";

    return `
      <tr>
        <td style="text-align: center; vertical-align: top;">${idx + 1}</td>
        <td style="vertical-align: top;">
          <div style="font-weight: 600; font-size: 13px; color: #0f172a;">${item.productName}</div>
          ${item.barcode ? `<div style="font-size: 10px; color: #64748b; font-family: Inter, sans-serif;">Mã vạch: ${item.barcode}</div>` : ""}
        </td>
        <td style="font-family: Inter, sans-serif; font-size: 11px; vertical-align: top; font-weight: 600;">${item.sku}</td>
        <td style="text-align: center; font-size: 11px; vertical-align: top;">${tracking}</td>
        <td style="text-align: right; font-weight: 600; vertical-align: top; font-size: 12px;">${item.systemQuantity}</td>
        <td style="text-align: right; font-weight: 600; vertical-align: top; font-size: 12px; color: ${isMatched ? "#0f172a" : isShortage ? "#b91c1c" : "#b45309"};">${item.countedQuantity}</td>
        <td style="text-align: right; font-weight: 600; vertical-align: top; font-size: 12px; color: ${isMatched ? "#047857" : isShortage ? "#dc2626" : "#d97706"};">
          ${item.quantityDelta > 0 ? "+" : ""}${item.quantityDelta}
        </td>
        <td style="font-size: 11px; color: #475569; vertical-align: top;">
          ${item.note || (isMatched ? "Khớp tồn" : isShortage ? `Thiếu ${Math.abs(item.quantityDelta)} máy` : `Thừa ${item.quantityDelta} máy`)}
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Biên Bản Kiểm Kê - ${count.countCode}</title>
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
          font-size: 20px;
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
          margin-bottom: 24px;
        }
        .signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          text-align: center;
          margin-top: 24px;
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
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="vertical-align: top; width: 62%;">
            <div style="font-weight: 600; font-size: 13px; text-transform: none; color: #0f172a;">
              HỆ THỐNG CỬA HÀNG ĐIỆN THOẠI & THIẾT BỊ DI ĐỘNG
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              Kho kiểm kê: <b>${warehouseName || "Kho bán hàng - Trụ sở chính"}</b>
            </div>
          </td>
          <td style="vertical-align: top; text-align: right; width: 38%;">
            <div style="font-size: 11px; font-weight: 600; color: #1e293b;">Mẫu số: 05 - VT</div>
            <div style="font-size: 10px; color: #64748b; font-style: italic;">(Ban hành theo TT 200/2014/TT-BTC)</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              Trạng thái: <b>${statusLabel}</b>
            </div>
          </td>
        </tr>
      </table>

      <div class="title-box">
        <h1 class="title-main">BIÊN BẢN KIỂM KÊ HÀNG HÓA</h1>
        <div class="title-sub">Thời điểm kiểm kê: Ngày ${day} tháng ${month} năm ${year} (lúc ${timeStr})</div>
        <div class="title-code">
          Mã số phiếu: <span style="font-family: Inter, sans-serif; font-size: 14px;">${count.countCode}</span>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: none; font-weight: 600;">Địa điểm kho</div>
          <div style="font-weight: 600; font-size: 13px; color: #0f172a; margin-top: 2px;">${warehouseName || "Kho bán hàng chính"}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #64748b; text-transform: none; font-weight: 600;">Quy mô kiểm đếm</div>
          <div style="font-size: 12px; color: #1e293b; margin-top: 2px;">
            Tổng cộng: <b>${count.items.length} mặt hàng SKU</b>
          </div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 32px; text-align: center;">STT</th>
            <th>Tên sản phẩm, quy cách phẩm chất</th>
            <th style="width: 130px;">Mã SKU</th>
            <th style="width: 90px; text-align: center;">Hình thức</th>
            <th style="width: 65px; text-align: right;">Sổ sách</th>
            <th style="width: 65px; text-align: right;">Thực tế</th>
            <th style="width: 65px; text-align: right;">Chênh lệch</th>
            <th style="width: 120px;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="total-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: #334155;">
            Tổng số lượng sổ sách: <b>${totalSystemQty} máy</b> &nbsp;·&nbsp;
            Tổng số lượng thực tế đếm: <b>${totalCountedQty} máy</b>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a;">
            Tổng chênh lệch:
            <span style="font-size: 15px; font-weight: 600; color: ${totalDelta === 0 ? "#047857" : totalDelta < 0 ? "#dc2626" : "#d97706"}; margin-left: 4px; font-family: Inter, sans-serif;">
              ${totalDelta > 0 ? "+" : ""}${totalDelta} máy
            </span>
          </div>
        </div>
      </div>

      <div class="signatures">
        <div>
          <div class="sig-title">Trưởng ban kiểm kê</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div class="sig-title">Thủ kho</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div class="sig-title">Kế toán trưởng / Giám đốc</div>
          <div class="sig-desc">(Ký, ghi rõ họ tên)</div>
        </div>
      </div>
    </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}
