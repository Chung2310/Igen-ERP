import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = {
  receivableRows: [] as any[],
  payrollRows: [] as any[],
  commissionRows: [] as any[],
  studentPipeline: [] as any[],
  payrollPipeline: [] as any[],
  partnerPipeline: [] as any[],
  operatingRows: [] as any[],
};

vi.mock("../modules/student-management/models/user.model", () => ({
  User: { find: () => ({ select: () => ({ lean: async () => [{ _id: "u1" }] }) }) },
}));
vi.mock("../modules/student-management/models/student.model", () => ({
  Student: { aggregate: async (pipeline: any[]) => { fixture.studentPipeline = pipeline; return fixture.receivableRows; } },
}));
vi.mock("../model/payroll-payment.model", () => ({
  PayrollPaymentModel: { aggregate: async (pipeline: any[]) => { fixture.payrollPipeline = pipeline; return fixture.payrollRows; } },
}));
vi.mock("../modules/student-management/models/partner.model", () => ({
  Partner: { aggregate: async (pipeline: any[]) => { fixture.partnerPipeline = pipeline; return fixture.commissionRows; } },
}));
vi.mock("../modules/student-management/models/payment.model", () => ({
  Payment: { aggregate: async () => [], countDocuments: async () => 0 },
}));
vi.mock("../model/stock-log.model", () => ({
  StockLogModel: { aggregate: async () => [], countDocuments: async () => 0 },
}));
vi.mock("../model/operating-expense.model", () => ({
  OperatingExpenseModel: { aggregate: async () => fixture.operatingRows },
}));

const { analyticsService } = await import("./analytics.service");
const RANGE = { from: new Date("2026-07-01T00:00:00.000Z"), to: new Date("2026-07-31T23:59:59.999Z"), granularity: "day" as const };

describe("công nợ, chi phí và P&L", () => {
  beforeEach(() => {
    fixture.receivableRows = [];
    fixture.payrollRows = [];
    fixture.commissionRows = [];
    fixture.studentPipeline = [];
    fixture.payrollPipeline = [];
    fixture.partnerPipeline = [];
    fixture.operatingRows = [];
    vi.restoreAllMocks();
  });

  it("tổng hợp đủ các bucket công nợ và giới hạn theo owner công ty", async () => {
    fixture.receivableRows = [
      { amountDue: 500, dueAt: null },
      { amountDue: 400, dueAt: "2026-06-15T23:59:59.999Z" },
      { amountDue: 600, dueAt: "2026-06-10T23:59:59.999Z" },
    ];
    const result = await analyticsService.getReceivables({ companyCode: "C1" }, RANGE.to);

    expect(result.total).toBe(1_500);
    expect(result.count).toBe(3);
    expect(result.aging).toHaveLength(5);
    expect(result.agingBasis).toBe("dueAt");
    expect(result.aging.find((row) => row.bucket === "0-30")?.amount).toBe(0);
    expect(fixture.studentPipeline[0].$match.ownerId.$in).toContain("C1");
    expect(fixture.studentPipeline[2].$match["installmentStatus.amountDue"].$gt).toBe(0);
    expect(fixture.studentPipeline[3].$project.dueAt).toBe("$installmentStatus.dueAt");
  });

  it("chỉ tính lương đã xác nhận và cộng hoa hồng có ngày hợp lệ", async () => {
    fixture.payrollRows = [{ _id: null, amount: 4_000, count: 2 }];
    fixture.commissionRows = [{ valid: [{ _id: null, amount: 600, count: 1 }], invalid: [{ count: 3 }] }];
    const result = await analyticsService.getExpenses({ companyCode: "C1" }, RANGE);

    expect(result.total).toBe(4_600);
    expect(result.excludedCommissionRecords).toBe(3);
    expect(fixture.payrollPipeline[0].$match).toMatchObject({ companyCode: "C1", status: "confirmed" });
    expect(fixture.partnerPipeline[0].$match.ownerId.$in).toContain("C1");
    expect(fixture.partnerPipeline[2].$addFields.payoutOn.$dateFromString.format).toBe("%d/%m/%Y");
  });

  it("tính kết quả vận hành và trả null khi thiếu giá vốn", async () => {
    vi.spyOn(analyticsService, "getCombinedRevenue").mockResolvedValue({
      total: 10_000, tuitionTotal: 8_000, goodsTotal: 2_000, goodsGrossProfit: 700,
      excludedCostLines: 0, range: { from: "", to: "", granularity: "day" },
    } as any);
    vi.spyOn(analyticsService, "getExpenses").mockResolvedValue({
      total: 3_000, payroll: { amount: 2_500 }, commission: { amount: 500 }, excludedCommissionRecords: 0,
    } as any);

    expect((await analyticsService.getProfitAndLoss({ companyCode: "C1" }, RANGE)).operatingResult).toBe(5_700);

    vi.mocked(analyticsService.getCombinedRevenue).mockResolvedValue({
      total: 10_000, tuitionTotal: 8_000, goodsTotal: 2_000, goodsGrossProfit: null,
      excludedCostLines: 1, range: { from: "", to: "", granularity: "day" },
    } as any);
    expect((await analyticsService.getProfitAndLoss({ companyCode: "C1" }, RANGE)).operatingResult).toBeNull();
  });
});
