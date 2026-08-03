import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kiểm tra phần logic thuần của báo cáo doanh thu: khoảng kỳ trước, tăng trưởng,
 * tổng hợp chuỗi thời gian và phạm vi công ty. Truy vấn Mongo được mock để test
 * chạy không cần DB.
 */
const fixture = {
  buckets: [] as any[],
  previousTotal: 0,
  excluded: 0,
  calls: [] as { match: any; stage: "series" | "previous" }[],
};

vi.mock("../modules/student-management/models/payment.model", () => ({
  Payment: {
    aggregate: async (pipeline: any[]) => {
      const match = pipeline[0].$match;
      const isSeries = pipeline.some((stage: any) => stage.$group?._id?.$dateToString);
      fixture.calls.push({ match, stage: isSeries ? "series" : "previous" });

      if (isSeries) return fixture.buckets;
      return fixture.previousTotal ? [{ _id: null, amount: fixture.previousTotal }] : [];
    },
    countDocuments: async () => fixture.excluded,
  },
}));

vi.mock("../modules/student-management/models/user.model", () => ({
  User: { find: () => ({ select: () => ({ lean: async () => [{ _id: "u1" }] }) }) },
}));

vi.mock("../model/stock-log.model", () => ({
  StockLogModel: { countDocuments: async () => 0 },
}));

const { analyticsService } = await import("./analytics.service");

const RANGE = {
  from: new Date("2026-07-01T00:00:00.000Z"),
  to: new Date("2026-07-31T23:59:59.999Z"),
  granularity: "day" as const,
};

describe("báo cáo doanh thu học phí", () => {
  beforeEach(() => {
    fixture.buckets = [];
    fixture.previousTotal = 0;
    fixture.excluded = 0;
    fixture.calls = [];
  });

  it("cộng đúng tổng doanh thu từ các nhóm thời gian", async () => {
    fixture.buckets = [
      { _id: "2026-07-01", amount: 1_000_000, count: 2 },
      { _id: "2026-07-02", amount: 500_000, count: 1 },
    ];

    const result = await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    expect(result.total).toBe(1_500_000);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].bucket).toBe("2026-07-01");
  });

  it("kỳ so sánh cùng độ dài và không chồng lấn kỳ hiện tại", async () => {
    await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    const previous = fixture.calls.find((call) => call.stage === "previous");
    expect(previous).toBeDefined();

    const span = RANGE.to.getTime() - RANGE.from.getTime();
    expect(previous!.match.paidOn.$gte.getTime()).toBe(RANGE.from.getTime() - span);
    // $lt chứ không phải $lte — nếu dùng $lte thì thời điểm giao giữa hai kỳ bị đếm hai lần.
    expect(previous!.match.paidOn.$lt.getTime()).toBe(RANGE.from.getTime());
  });

  it("tính % tăng trưởng so với kỳ trước", async () => {
    fixture.buckets = [{ _id: "2026-07-01", amount: 1_500_000, count: 1 }];
    fixture.previousTotal = 1_000_000;

    const result = await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    expect(result.previousTotal).toBe(1_000_000);
    expect(result.growthPct).toBe(50);
  });

  it("không có kỳ trước thì growthPct là null, không phải 0", async () => {
    fixture.buckets = [{ _id: "2026-07-01", amount: 1_500_000, count: 1 }];
    fixture.previousTotal = 0;

    const result = await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    // 0% bị đọc là "không tăng trưởng", khác hẳn "chưa có số liệu để so".
    expect(result.growthPct).toBeNull();
  });

  it("báo số giao dịch bị loại vì thiếu paidOn thay vì im lặng làm thiếu doanh thu", async () => {
    fixture.buckets = [{ _id: "2026-07-01", amount: 1_000_000, count: 1 }];
    fixture.excluded = 7;

    const result = await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    expect(result.excludedRecords).toBe(7);
  });

  it("mọi truy vấn đều bị giới hạn theo ownerId của công ty", async () => {
    await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    expect(fixture.calls.length).toBeGreaterThan(0);
    for (const call of fixture.calls) {
      expect(call.match.ownerId?.$in).toBeDefined();
      expect(call.match.ownerId.$in).toContain("C1");
    }
  });

  it("gom nhóm theo paidOn, không phải theo chuỗi date", async () => {
    await analyticsService.getTuitionRevenue({ companyCode: "C1" }, RANGE);

    for (const call of fixture.calls) {
      expect(call.match.paidOn).toBeDefined();
      expect(call.match.date).toBeUndefined();
    }
  });
});
