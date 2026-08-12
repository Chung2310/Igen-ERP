// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import RetailReportTables from "./RetailReportTables";

it("renders product tables, selected range and read-only analytics reconciliation", () => {
  const report: any = {
    range: { from: "2026-08-01", to: "2026-08-10" },
    analyticsReconciliation: { retailNetSales: 100, analyticsNetSales: 80, difference: 20, matched: false },
    cashiers: [], shifts: [], debt: { totalDebt: 0, overdueDebt: 0, dueTodayDebt: 0, upcomingDebt: 0, customers: [] },
    products: [{ productId: "p1", sku: "A", productName: "Tea", netQuantity: 2, netSales: 100 }],
    slowProducts: [{ productId: "p2", sku: "B", productName: "Cake", netQuantity: 1, netSales: 20 }],
  };
  render(<RetailReportTables report={report} />);
  expect(screen.getByRole("table", { name: "Sản phẩm bán chạy" })).toBeTruthy();
  expect(screen.getByRole("table", { name: "Sản phẩm bán chậm" })).toBeTruthy();
  expect(screen.getAllByText("01/08/2026 – 10/08/2026")).toHaveLength(2);
  expect(screen.getByText("Chênh lệch Retail – Analytics")).toBeTruthy();
});
