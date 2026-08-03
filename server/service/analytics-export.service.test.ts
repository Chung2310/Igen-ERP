import { describe, expect, it } from "vitest";
import XLSX from "xlsx";
import { analyticsWorkbookBuffer, buildAnalyticsCsv, buildAnalyticsWorkbook } from "./analytics-export.service";

const data = {
  revenue: {
    series: [{ bucket: "2026-07", tuitionAmount: 1_000, goodsAmount: 500, amount: 1_500, tuitionCount: 2, goodsCount: 1 }],
    goodsBreakdown: [{ category: "Phụ kiện", revenue: 500, grossProfit: 200, quantity: 2 }],
  },
  receivables: { aging: [{ bucket: "31-60", amount: 700, count: 1 }] },
  expenses: { payroll: { amount: 300, count: 1 }, commission: { amount: 100, count: 1 }, total: 400 },
  pnl: { tuitionRevenue: 1_000, goodsRevenue: 500, goodsGrossProfit: 200, payrollExpense: 300, commissionExpense: 100, operatingResult: 800 },
};

describe("analytics exports", () => {
  it("tạo workbook tổng hợp với các sheet báo cáo ổn định", () => {
    const workbook = buildAnalyticsWorkbook("overview", data);
    expect(workbook.SheetNames).toEqual(["Doanh thu theo thời gian", "Nhóm sản phẩm", "Công nợ", "Chi phí", "Kết quả vận hành"]);
    expect(workbook.Sheets["Doanh thu theo thời gian"]["A1"].v).toBe("Kỳ");
    expect(workbook.Sheets["Doanh thu theo thời gian"]["D2"].v).toBe(1_500);
    expect(workbook.Sheets["Kết quả vận hành"]["B7"].v).toBe(800);
  });

  it("ghi được buffer XLSX có thể đọc lại", () => {
    const buffer = analyticsWorkbookBuffer(buildAnalyticsWorkbook("expenses", data));
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Chi phí"]);
    expect(workbook.Sheets["Chi phí"]["B4"].v).toBe(400);
  });

  it("CSV có BOM UTF-8 và chỉ chứa báo cáo đã chọn", () => {
    const csv = buildAnalyticsCsv("receivables", data);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Nhóm tuổi");
    expect(csv).toContain("31-60 ngày");
    expect(csv).not.toContain("Lương đã thanh toán");
  });

  it("giữ trạng thái thiếu dữ liệu thay vì biến thành số 0", () => {
    const workbook = buildAnalyticsWorkbook("pnl", { pnl: { ...data.pnl, goodsGrossProfit: null, operatingResult: null } });
    expect(workbook.Sheets["Kết quả vận hành"]["B4"].v).toBe("Chưa đủ dữ liệu");
    expect(workbook.Sheets["Kết quả vận hành"]["B7"].v).toBe("Chưa đủ dữ liệu");
  });
});
