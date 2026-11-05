// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FinanceOverviewDashboard from "./FinanceOverviewDashboard";

afterEach(cleanup);

describe("FinanceOverviewDashboard", () => {
  it("shows the supported finance views from one report", () => {
    const view = render(<FinanceOverviewDashboard period="month" from="2026-11-01" to="2026-11-05" report={{
      summary: { revenue: 1000, cost: 400, grossProfit: 600, netProfit: 500, expense: 100, cashIn: 800, cashOut: 200, receivable: 300, payable: 120, inventoryValue: 900 },
      trends: [{ date: "2026-11-05", revenue: 1000, cost: 400, expense: 100 }],
      cash: [{ date: "2026-11-05", kind: "receipt", amount: 800, method: "cash" }],
      expenses: [{ category: "rent", expenseClass: "fixed", amount: 100 }],
      debts: { receivables: [{ customerName: "Khách A", balance: 300, daysUntil: -2, dueDate: "2026-11-03" }], payables: [] },
      lines: [{ category: "Điện thoại", brand: "A", revenue: 1000, cost: 400, quantity: 1 }],
      inventory: [{ band: "0-30", cost: 500, risk: 0 }],
      vat: { input: 20, output: 50, payable: 30, nextCarryforward: 0 },
      breakeven: { progress: 60, fixedCosts: 100, variableCosts: 0, dailyNeeded: 50 },
    }} />);
    expect(screen.getByText("Doanh thu theo kỳ")).toBeTruthy();
    expect(screen.getByText("Tuổi nợ phải thu")).toBeTruthy();
    expect(screen.getByText("Tuổi hàng tồn theo IMEI")).toBeTruthy();
    expect(screen.getByText("VAT đầu vào và đầu ra")).toBeTruthy();
    expect(screen.getByText("Khách A")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(view.container.querySelectorAll(".finance-kpi")).toHaveLength(6);
    expect(view.container.querySelectorAll(".finance-kpi .text-white")).toHaveLength(12);
    expect(screen.getByText("Doanh thu theo kỳ").closest(".finance-chart-card")?.classList.contains("xl:col-span-2")).toBe(true);
    expect(screen.getByText("Thu, chi và dòng tiền ròng").closest(".finance-chart-card")?.classList.contains("xl:col-span-2")).toBe(true);
  });

  it("keeps unknown profit unknown and charts empty when no transactions exist", () => {
    render(<FinanceOverviewDashboard period="month" from="2026-11-01" to="2026-11-05" report={{ summary: { revenue: 0, cost: null, grossProfit: null, netProfit: null }, trends: [], cash: [], expenses: [], debts: { receivables: [], payables: [] }, lines: [], inventory: [] }} />);
    expect(screen.getAllByText("Chưa có dữ liệu").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Chưa có dữ liệu trong phạm vi đã chọn.").length).toBeGreaterThanOrEqual(10);
  });
});
