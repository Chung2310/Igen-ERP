// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RetailReport } from "../../types";
import RetailSalesCharts from "./RetailSalesCharts";

function chartReport(timeSeries: RetailReport["timeSeries"]): RetailReport {
  return {
    products: [],
    slowProducts: [],
    range: { from: "2026-08-10", to: "2026-08-10" },
    summary: { grossSales: 0, refunds: 0, netSales: 0, orderCount: 0, averageOrderValue: 0, collectedAmount: 0, dueAmount: 0 },
    timeSeries,
    paymentMix: [],
    cashiers: [],
    shifts: [],
    debt: { totalDebt: 0, overdueDebt: 0, dueTodayDebt: 0, upcomingDebt: 0, customers: [] },
  };
}

afterEach(cleanup);

describe("RetailSalesCharts", () => {
  it("labels and scales the trend from only the three rendered series", () => {
    render(<RetailSalesCharts report={chartReport([{
      businessDate: "2026-08-10",
      grossSales: 9_000_000,
      netSales: 100,
      collectedAmount: 80,
      refunds: 10,
      orderCount: 1,
    }])} />);

    expect(screen.getByText("Cao nhất: 100 ₫")).toBeTruthy();
  });

  it("shows an actual maximum of zero while retaining a safe SVG denominator", () => {
    render(<RetailSalesCharts report={chartReport([{
      businessDate: "2026-08-10",
      grossSales: 0,
      netSales: 0,
      collectedAmount: 0,
      refunds: 0,
      orderCount: 0,
    }])} />);

    expect(screen.getByText("Cao nhất: 0 ₫")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Xu hướng doanh thu theo ngày" })).toBeTruthy();
  });
});
