import { describe, expect, it, vi } from "vitest";
import { LEGACY_STATUS_MAP, mapLegacyPayrollRunStatus, migrateLegacyPayrollRunStatuses } from "./payroll-run-status-migration";

describe("payroll run status migration", () => {
  it("maps every legacy status to the canonical workflow", () => {
    expect(LEGACY_STATUS_MAP).toEqual({
      draft: "draft", attendance_locked: "draft", calculated: "review", reviewed: "review",
      approved: "review", closed: "closed", partially_paid: "closed", paid: "paid",
    });
    expect(mapLegacyPayrollRunStatus("unknown")).toBeUndefined();
  });

  it("uses idempotent scoped updates and reports overpaid anomalies", async () => {
    const updates: any[] = [];
    const runs: any = {
      updateMany: vi.fn(async (filter, update) => { updates.push({ filter, update }); return { modifiedCount: filter.status === "calculated" ? 2 : 0 }; }),
      aggregate: vi.fn(() => ({ toArray: async () => [{ _id: "fully-paid", settlement: "paid" }, { _id: "overpaid", settlement: "overpaid" }] })),
    };
    const payments: any = {};

    const first = await migrateLegacyPayrollRunStatuses(runs, payments);
    const second = await migrateLegacyPayrollRunStatuses(runs, payments);

    expect(first).toEqual({ migrated: 2, paidReconciled: 0, overpaidAnomalies: 1 });
    expect(second).toEqual({ migrated: 2, paidReconciled: 0, overpaidAnomalies: 1 });
    expect(updates).toContainEqual({ filter: { status: "calculated" }, update: { $set: { status: "review" } } });
    expect(updates).not.toContainEqual(expect.objectContaining({ filter: { status: "paid" } }));
    expect(updates).toContainEqual({ filter: { _id: { $in: ["fully-paid"] }, status: "closed" }, update: { $set: { status: "paid" } } });
  });
});
