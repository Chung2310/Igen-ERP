import { describe, expect, it } from "vitest";
import { calculateAnnualLeaveEntitlement, selectChargeableWorkingDates } from "./annual-leave.service";

describe("annual leave entitlement", () => {
  it("prorates official employees from their official month and rounds down", () => {
    expect(calculateAnnualLeaveEntitlement({ annualDays: 20, employmentStatus: "official", officialMonth: 8 })).toBe(8);
  });

  it("gives probation and interns no leave", () => {
    expect(calculateAnnualLeaveEntitlement({ annualDays: 20, employmentStatus: "probation", officialMonth: 1 })).toBe(0);
    expect(calculateAnnualLeaveEntitlement({ annualDays: 20, employmentStatus: "internship", officialMonth: 1 })).toBe(0);
  });

  it("uses the working dates only", () => {
    expect(selectChargeableWorkingDates(
      ["2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31"],
      new Set(["2026-08-28", "2026-08-31"]),
    )).toEqual(["2026-08-28", "2026-08-31"]);
  });
});