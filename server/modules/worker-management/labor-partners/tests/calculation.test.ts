import { describe, expect, it } from "vitest";
import { mergeAttendanceIntervals } from "../services/calculation/attendance-interval-merger";
import { calculateOfficialMilestones } from "../services/calculation/official-calculator";
import { calculateSeasonalCommission } from "../services/calculation/seasonal-calculator";

describe("labor partner commission calculation", () => {
  const seasonal = { tiers: [{ minHours: 0, maxHours: 10, hourlyRate: 100 }, { minHours: 10, maxHours: null, hourlyRate: 200 }], hourRounding: { unitMinutes: 1 as const, mode: "nearest" as const }, moneyRounding: { unitVnd: 1, mode: "nearest" as const } };
  it("merges overlapping project intervals before counting minutes", () => {
    const merged = mergeAttendanceIntervals([
      { workerId: "w1", sourceLogId: "a", start: new Date("2026-08-01T01:00:00Z"), end: new Date("2026-08-01T05:00:00Z") },
      { workerId: "w1", sourceLogId: "b", start: new Date("2026-08-01T04:00:00Z"), end: new Date("2026-08-01T08:00:00Z") },
    ]);
    expect(merged).toEqual([{ workerId: "w1", projectId: undefined, minutes: 420, sourceLogIds: ["a", "b"] }]);
  });
  it("uses the configured flat tier for all eligible hours", () => {
    expect(calculateSeasonalCommission(12 * 60, { ...seasonal, tierMode: "flat" })).toMatchObject({ hourlyRate: 200, amount: 2400 });
  });
  it("supports progressive tiers without hard-coded prices", () => {
    expect(calculateSeasonalCommission(12 * 60, { ...seasonal, tierMode: "progressive" })).toMatchObject({ amount: 1400 });
  });
  it("calculates one commission from the partner's aggregate monthly hours", () => {
    const aggregate = { ...seasonal, tierMode: "flat" as const, tiers: [{ minHours: 0, maxHours: null, hourlyRate: 100 }] };
    const totalHours = 150 * 100;
    expect(calculateSeasonalCommission(totalHours * 60, aggregate)).toMatchObject({ eligibleMinutes: totalHours * 60, amount: 1500000 });
  });
  it("does not create an official milestone twice", () => {
    const result = calculateOfficialMilestones({ employmentStartDate: "2026-01-31", periodStart: "2026-02-01", periodEnd: "2026-03-01", milestones: [{ month: 1, amount: 999, eligibilityRule: "contract_active" }], alreadyApprovedMonths: [], isEligible: () => true });
    expect(result).toEqual([{ month: 1, dueDate: "2026-02-28", amount: 999 }]);
    expect(calculateOfficialMilestones({ employmentStartDate: "2026-01-31", periodStart: "2026-02-01", periodEnd: "2026-03-01", milestones: [{ month: 1, amount: 999, eligibilityRule: "contract_active" }], alreadyApprovedMonths: [1], isEligible: () => true })).toEqual([]);
  });
});
