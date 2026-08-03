// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsTab from "./AnalyticsTab";

const mocks = vi.hoisted(() => ({
  getRevenue: vi.fn(), getMeta: vi.fn(), getReceivables: vi.fn(), getExpenses: vi.fn(), downloadExport: vi.fn(), createOperatingExpense: vi.fn(), listOperatingExpenses: vi.fn(), updateOperatingExpense: vi.fn(), voidOperatingExpense: vi.fn(),
}));

vi.mock("../services/analyticsService", () => ({ analyticsService: mocks }));
vi.mock("../components/analytics/RevenueChart", () => ({ RevenueChart: () => <div data-testid="revenue-chart" /> }));

describe("AnalyticsTab staging smoke", () => {
  beforeEach(() => {
    mocks.getMeta.mockResolvedValue({ sources: [], grossProfitAvailable: true, currency: "VND", filters: { branches: [{ id: "b1", code: "HN", name: "Hà Nội" }], courses: [{ id: "c1", code: "K1", name: "Khóa 1", branchId: "b1" }] } });
    mocks.getRevenue.mockResolvedValue({ total: 100, tuitionTotal: 100, goodsTotal: 0, previousTotal: 0, growthPct: null, series: [], excludedRecords: 0, excludedGoodsLines: 0, excludedCostLines: 0, excludedUnclassifiedStockOut: 0, goodsGrossProfit: 0, goodsBreakdown: [], range: { from: "", to: "", granularity: "day" }, currency: "VND" });
    mocks.getReceivables.mockResolvedValue({ total: 0, count: 0, aging: [], agingBasis: "dueAt", currency: "VND" });
    mocks.listOperatingExpenses.mockResolvedValue([]);
    mocks.getExpenses.mockResolvedValue({ total: 0, payroll: { amount: 0, count: 0 }, commission: { amount: 0, count: 0 }, operating: { amount: 0, count: 0 }, operatingByCategory: [], excludedCommissionRecords: 0, range: { from: "", to: "" }, currency: "VND" });
  });

  it("renders dashboard and forwards branch/course filters", async () => {
    const user = userEvent.setup();
    render(<AnalyticsTab />);
    expect(await screen.findByText("Tổng doanh thu")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Chi nhánh"), "b1");
    await waitFor(() => expect(mocks.getRevenue).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: "b1" })));
    await user.selectOptions(screen.getByLabelText("Khóa học"), "c1");
    await waitFor(() => expect(mocks.getRevenue).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: "b1", courseId: "c1" })));
  });
});
