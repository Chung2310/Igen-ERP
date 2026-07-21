import { describe, expect, it, vi } from "vitest";

vi.mock("../service/company-work-calendar.service", () => ({
  listWorkingDates: vi.fn(async (_companyCode: string, start: string, end: string) => {
    const all: Record<string, string[]> = {
      "2026-04-29|2026-05-04": ["2026-04-29", "2026-05-04"],
    };
    return all[`${start}|${end}`] ?? [];
  }),
  toVietnamDate: (date: Date) => date.toISOString().slice(0, 10),
}));

import { computeChargeableSnapshot, shouldSnapshotChargeableDays } from "./crud.controller";

describe("shouldSnapshotChargeableDays", () => {
  it("snapshots leave-type applications transitioning into approved", () => {
    expect(shouldSnapshotChargeableDays({ status: "pending", type: "leave" })).toBe(true);
  });

  it("does not re-snapshot already-approved applications", () => {
    expect(shouldSnapshotChargeableDays({ status: "approved", type: "leave" })).toBe(false);
  });

  it("does not snapshot non-leave application types", () => {
    expect(shouldSnapshotChargeableDays({ status: "pending", type: "late" })).toBe(false);
    expect(shouldSnapshotChargeableDays({ status: "pending", type: "early" })).toBe(false);
    expect(shouldSnapshotChargeableDays({ status: "pending", type: "other" })).toBe(false);
  });

  it("does not snapshot missing applications", () => {
    expect(shouldSnapshotChargeableDays(null)).toBe(false);
    expect(shouldSnapshotChargeableDays(undefined)).toBe(false);
  });
});

describe("computeChargeableSnapshot", () => {
  it("stores only working dates, excluding weekend and holiday dates within the range", async () => {
    const result = await computeChargeableSnapshot("IGEN", {
      startDate: new Date("2026-04-29T00:00:00.000Z"),
      endDate: new Date("2026-05-04T00:00:00.000Z"),
    });

    expect(result.chargeableDates).toEqual(["2026-04-29", "2026-05-04"]);
    expect(result.chargeableDays).toBe(2);
  });
});
