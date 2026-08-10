import XLSX from "xlsx";
import type { RetailReportModel } from "./retail-report-metrics";

type RetailReportWorkbookOptions = {
  includeProfit: boolean;
  branchCode: string;
};

type SpreadsheetCell = string | number | undefined;

export function escapeSpreadsheetCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function sheet(rows: SpreadsheetCell[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((value) => (
    typeof value === "string" ? escapeSpreadsheetCell(value) : value
  ))));
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return sanitized || fallback;
}

export function buildRetailReportWorkbook(
  model: RetailReportModel,
  options: RetailReportWorkbookOptions,
): { buffer: Buffer; filename: string } {
  const overview: SpreadsheetCell[][] = [
    ["Chỉ số", "Giá trị"],
    ["Từ ngày", model.range.from],
    ["Đến ngày", model.range.to],
    ["Doanh thu gộp", model.summary.grossSales],
    ["Hoàn tiền", model.summary.refunds],
    ["Doanh thu thuần", model.summary.netSales],
    ["Số đơn", model.summary.orderCount],
    ["Giá trị đơn trung bình", model.summary.averageOrderValue],
    ["Đã thu", model.summary.collectedAmount],
    ["Còn phải thu", model.summary.dueAmount],
  ];
  if (options.includeProfit) {
    overview.push(
      ["Giá vốn", model.summary.totalCost ?? 0],
      ["Lợi nhuận gộp", model.summary.grossProfit ?? 0],
      ["Biên lợi nhuận gộp (%)", model.summary.grossMarginPercent ?? 0],
    );
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet(overview), "Tổng quan");
  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Ngày", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Đã thu", "Số đơn"],
    ...model.timeSeries.map((row) => [
      row.businessDate,
      row.grossSales,
      row.refunds,
      row.netSales,
      row.collectedAmount,
      row.orderCount,
    ]),
  ]), "Theo ngày");
  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Phương thức", "Số tiền"],
    ...model.paymentMix.map((row) => [row.method, row.amount]),
  ]), "Thanh toán");
  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Mã thu ngân", "Thu ngân", "Số đơn", "Doanh thu gộp", "Hoàn tiền", "Doanh thu thuần", "Giá trị đơn trung bình"],
    ...model.cashiers.map((row) => [
      row.cashierId,
      row.cashierName,
      row.orderCount,
      row.grossSales,
      row.refunds,
      row.netSales,
      row.averageOrderValue,
    ]),
  ]), "Thu ngân");
  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Mã ca", "Ngày", "Mã thu ngân", "Thu ngân", "Trạng thái", "Doanh thu gộp", "Đã thu", "Hoàn tiền", "Chênh lệch"],
    ...model.shifts.map((row) => [
      row.shiftCode,
      row.businessDate,
      row.cashierId,
      row.cashierName,
      row.status,
      row.grossSales,
      row.collectedAmount,
      row.refundedAmount,
      row.varianceAmount,
    ]),
  ]), "Ca bán hàng");
  XLSX.utils.book_append_sheet(workbook, sheet([
    ["Chỉ số công nợ", "Giá trị"],
    ["Tổng công nợ", model.debt.totalDebt],
    ["Quá hạn", model.debt.overdueDebt],
    ["Đến hạn hôm nay", model.debt.dueTodayDebt],
    ["Sắp đến hạn", model.debt.upcomingDebt],
    [],
    ["Mã khách hàng", "Khách hàng", "Điện thoại", "Tổng công nợ", "Nợ quá hạn", "Hạn gần nhất", "Số đơn"],
    ...model.debt.customers.map((row) => [
      row.customerId,
      row.customerName,
      row.customerPhone,
      row.totalDebt,
      row.overdueDebt,
      row.nearestDueDate,
      row.orderCount,
    ]),
  ]), "Công nợ");

  const branchCode = sanitizeFilenamePart(options.branchCode, "chi-nhanh");
  const from = sanitizeFilenamePart(model.range.from, "tu-ngay");
  const to = sanitizeFilenamePart(model.range.to, "den-ngay");
  return {
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    filename: `bao-cao-ban-le-${branchCode}-${from}-${to}.xlsx`,
  };
}
