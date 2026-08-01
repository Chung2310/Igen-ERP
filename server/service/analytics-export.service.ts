import XLSX from "xlsx";

export type AnalyticsExportReport = "overview" | "revenue" | "receivables" | "expenses" | "pnl";
export type AnalyticsExportFormat = "xlsx" | "csv";

type ExportData = {
  revenue?: any;
  receivables?: any;
  expenses?: any;
  pnl?: any;
};

const money = (value: unknown) => typeof value === "number" ? value : "Chưa đủ dữ liệu";

function revenueRows(report: any) {
  return report.series.map((row: any) => ({
    "Kỳ": row.bucket,
    "Doanh thu học phí": row.tuitionAmount,
    "Doanh thu bán hàng": row.goodsAmount,
    "Tổng doanh thu": row.amount,
    "Số giao dịch học phí": row.tuitionCount,
    "Số dòng bán hàng": row.goodsCount,
  }));
}

function receivableRows(report: any) {
  const labels: Record<string, string> = { notScheduled: "Chưa đặt hạn", notDue: "Chưa đến hạn", "0-30": "0-30 ngày", "31-60": "31-60 ngày", "60+": "Trên 60 ngày" };
  return report.aging.map((row: any) => ({ "Nhóm tuổi": labels[row.bucket] || row.bucket, "Số tiền": row.amount, "Số đợt": row.count, "Cơ sở tính tuổi": "Ngày đến hạn" }));
}

function expenseRows(report: any) {
  return [
    { "Loại chi phí": "Lương đã thanh toán", "Số tiền": report.payroll.amount, "Số khoản": report.payroll.count },
    { "Loại chi phí": "Hoa hồng đã chi", "Số tiền": report.commission.amount, "Số khoản": report.commission.count },
    { "Loại chi phí": "Chi phí vận hành chung", "Số tiền": report.operating?.amount || 0, "Số khoản": report.operating?.count || 0 },
    { "Loại chi phí": "Tổng chi phí", "Số tiền": report.total, "Số khoản": report.payroll.count + report.commission.count + (report.operating?.count || 0) },
  ];
}

function pnlRows(report: any) {
  return [
    { "Chỉ tiêu": "Doanh thu học phí", "Số tiền": report.tuitionRevenue },
    { "Chỉ tiêu": "Doanh thu bán hàng", "Số tiền": report.goodsRevenue },
    { "Chỉ tiêu": "Lãi gộp hàng hóa", "Số tiền": money(report.goodsGrossProfit) },
    { "Chỉ tiêu": "Lương đã thanh toán", "Số tiền": -report.payrollExpense },
    { "Chỉ tiêu": "Hoa hồng đã chi", "Số tiền": -report.commissionExpense },
    { "Chỉ tiêu": "Chi phí vận hành chung", "Số tiền": -(report.generalOperatingExpense || 0) },
    { "Chỉ tiêu": "Kết quả vận hành", "Số tiền": money(report.operatingResult) },
  ];
}

function appendSheet(workbook: XLSX.WorkBook, rows: Record<string, unknown>[], name: string) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

export function buildAnalyticsWorkbook(report: AnalyticsExportReport, data: ExportData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  if ((report === "overview" || report === "revenue") && data.revenue) {
    appendSheet(workbook, revenueRows(data.revenue), "Doanh thu theo thời gian");
    appendSheet(workbook, data.revenue.goodsBreakdown.map((row: any) => ({ "Nhóm sản phẩm": row.category, "Doanh thu": row.revenue, "Lãi gộp": money(row.grossProfit), "Số lượng": row.quantity })), "Nhóm sản phẩm");
  }
  if ((report === "overview" || report === "receivables") && data.receivables) appendSheet(workbook, receivableRows(data.receivables), "Công nợ");
  if ((report === "overview" || report === "expenses") && data.expenses) appendSheet(workbook, expenseRows(data.expenses), "Chi phí");
  if ((report === "overview" || report === "pnl") && data.pnl) appendSheet(workbook, pnlRows(data.pnl), "Kết quả vận hành");
  return workbook;
}

export function buildAnalyticsCsv(report: Exclude<AnalyticsExportReport, "overview">, data: ExportData): string {
  const rows = report === "revenue" ? revenueRows(data.revenue)
    : report === "receivables" ? receivableRows(data.receivables)
      : report === "expenses" ? expenseRows(data.expenses)
        : pnlRows(data.pnl);
  const sheet = XLSX.utils.json_to_sheet(rows);
  return `\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`;
}

export function analyticsWorkbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
