import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = {
  paymentResults: [] as any[][],
  stockResults: [] as any[][],
  stockPipelines: [] as any[][],
  excludedTuition: 0,
  unclassifiedStockOut: 0,
};

vi.mock("../modules/student-management/models/payment.model", () => ({
  Payment: {
    aggregate: async () => fixture.paymentResults.shift() || [],
    countDocuments: async () => fixture.excludedTuition,
  },
}));

vi.mock("../modules/student-management/models/user.model", () => ({
  User: { find: () => ({ select: () => ({ lean: async () => [{ _id: "u1" }] }) }) },
}));

vi.mock("../model/stock-log.model", () => ({
  StockLogModel: {
    aggregate: async (pipeline: any[]) => {
      fixture.stockPipelines.push(pipeline);
      return fixture.stockResults.shift() || [];
    },
    countDocuments: async () => fixture.unclassifiedStockOut,
  },
}));

const { analyticsService } = await import("./analytics.service");

const RANGE = {
  from: new Date("2026-07-01T00:00:00.000Z"),
  to: new Date("2026-07-31T23:59:59.999Z"),
  granularity: "day" as const,
};

describe("báo cáo doanh thu gộp", () => {
  beforeEach(() => {
    fixture.paymentResults = [];
    fixture.stockResults = [];
    fixture.stockPipelines = [];
    fixture.excludedTuition = 0;
    fixture.unclassifiedStockOut = 0;
  });

  it("gộp hai nguồn theo bucket và tính lãi gộp từ snapshot", async () => {
    fixture.paymentResults = [
      [{ _id: "2026-07-01", amount: 1_000, count: 2 }],
      [{ _id: null, amount: 800 }],
    ];
    fixture.stockResults = [
      [{ _id: "2026-07-01", amount: 500, count: 1, cost: 300 }],
      [{ _id: null, amount: 200 }],
      [{ _id: null, missingPriceLines: 0, missingCostLines: 0 }],
      [{ _id: "Phụ kiện", revenue: 500, cost: 300, quantity: 2, missingCostLines: 0 }],
    ];

    const result = await analyticsService.getCombinedRevenue({ companyCode: "C1" }, RANGE);

    expect(result.total).toBe(1_500);
    expect(result.tuitionTotal).toBe(1_000);
    expect(result.goodsTotal).toBe(500);
    expect(result.previousTotal).toBe(1_000);
    expect(result.growthPct).toBe(50);
    expect(result.goodsGrossProfit).toBe(200);
    expect(result.series[0]).toMatchObject({ tuitionAmount: 1_000, goodsAmount: 500, amount: 1_500 });
    expect(result.goodsBreakdown[0]).toMatchObject({ category: "Phụ kiện", revenue: 500, grossProfit: 200 });
  });

  it("chỉ truy vấn phiếu xuất bán đúng công ty và ẩn lãi gộp khi thiếu giá vốn", async () => {
    fixture.unclassifiedStockOut = 3;
    fixture.paymentResults = [[], []];
    fixture.stockResults = [
      [{ _id: "2026-07-02", amount: 400, count: 1, cost: 0 }],
      [],
      [{ _id: null, missingPriceLines: 2, missingCostLines: 1 }],
      [{ _id: "Khác", revenue: 400, cost: 0, quantity: 1, missingCostLines: 1 }],
    ];

    const result = await analyticsService.getCombinedRevenue({ companyCode: "C1" }, RANGE);

    for (const pipeline of fixture.stockPipelines) {
      expect(pipeline[0].$match).toMatchObject({ companyCode: "C1", type: "xuất", purpose: "bán" });
    }
    expect(result.goodsGrossProfit).toBeNull();
    expect(result.goodsBreakdown[0].grossProfit).toBeNull();
    expect(result.excludedGoodsLines).toBe(2);
    expect(result.excludedCostLines).toBe(1);
    expect(result.excludedUnclassifiedStockOut).toBe(3);
  });
});
