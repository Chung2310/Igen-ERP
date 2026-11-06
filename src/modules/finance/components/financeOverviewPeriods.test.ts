import { describe, expect, it } from "vitest";
import { aggregateRevenueTrends } from "./financeOverviewPeriods";

const trends = [
  { date: "2026-11-01", revenue: 100, cost: 40, expense: 10 },
  { date: "2026-11-02", revenue: 200, cost: null, expense: 20 },
  { date: "2026-11-09", revenue: 300, cost: 100, expense: 30 },
];

describe("finance revenue periods", () => {
  it("shows each day of a selected week as a column", () => {
    const buckets = aggregateRevenueTrends(trends, "week", "2026-11-01", "2026-11-07");
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toMatchObject({ label: "01/11", revenue: 100 });
    expect(buckets[2]).toMatchObject({ label: "03/11", revenue: 0 });
  });

  it("groups a month into calendar weeks without inventing profit when cost is unknown", () => {
    const buckets = aggregateRevenueTrends(trends, "month", "2026-11-01", "2026-11-30");
    expect(buckets.slice(0, 3).map(bucket => bucket.revenue)).toEqual([100, 200, 300]);
    expect(buckets[1]).toMatchObject({ cost: null, net: null });
  });

  it("shows monthly columns for a quarter or year", () => {
    const quarter = aggregateRevenueTrends(trends, "quarter", "2026-10-01", "2026-11-30");
    expect(quarter.map(bucket => bucket.label)).toEqual(["Tháng 10", "Tháng 11"]);
    expect(quarter[1].revenue).toBe(600);
    expect(quarter[1].net).toBeNull();
    const year = aggregateRevenueTrends(trends, "year", "2026-01-01", "2026-11-30");
    expect(year).toHaveLength(11);
    expect(year[10].revenue).toBe(600);
  });

  it("returns no columns while a custom date range is incomplete", () => {
    expect(aggregateRevenueTrends(trends, "custom", "", "2026-11-30")).toEqual([]);
  });
});
