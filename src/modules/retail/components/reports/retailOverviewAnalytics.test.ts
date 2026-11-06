import { describe, expect, it } from "vitest";
import { aggregateSales, comparison, groupProducts, previousRangeFilters } from "./retailOverviewAnalytics";

describe("retail overview analytics", () => {
  it("compares against an equally long prior period and preserves dimension filters", () => {
    expect(previousRangeFilters({ from: "2026-11-01", to: "2026-11-07" }, { preset: "7d", category: "Điện thoại" })).toEqual({ from: "2026-10-25", to: "2026-10-31", category: "Điện thoại" });
    expect(comparison(120, 100)).toEqual({ amount: 20, percent: 20 });
    expect(comparison(5, 0)).toEqual({ amount: 5, percent: null });
  });

  it("groups daily sales by week and product category without inventing values", () => {
    const daily = [
      { businessDate: "2026-11-01", grossSales: 100, refunds: 10, netSales: 90, collectedAmount: 80, orderCount: 2 },
      { businessDate: "2026-11-02", grossSales: 200, refunds: 0, netSales: 200, collectedAmount: 180, orderCount: 1 },
    ];
    expect(aggregateSales(daily, "week")).toEqual([
      { label: "Tuần 26/10", grossSales: 100, refunds: 10, netSales: 90, collectedAmount: 80, orderCount: 2, averageOrderValue: 50 },
      { label: "Tuần 02/11", grossSales: 200, refunds: 0, netSales: 200, collectedAmount: 180, orderCount: 1, averageOrderValue: 200 },
    ]);
    expect(groupProducts([
      { productId: "a", sku: "A", productName: "A", category: "Điện thoại", netQuantity: 2, netSales: 100 },
      { productId: "b", sku: "B", productName: "B", category: "Điện thoại", netQuantity: 1, netSales: 70 },
    ], "category")).toEqual([{ name: "Điện thoại", quantity: 3, sales: 170 }]);
  });
});
