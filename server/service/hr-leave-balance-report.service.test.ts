import { describe, expect, it } from "vitest";
import { buildLeaveBalanceReport } from "./hr-leave-balance-report.service";

describe("buildLeaveBalanceReport", () => {
  it("uses annual leave entitlement rules and separates used, pending, and unexcused leave", () => {
    const report = buildLeaveBalanceReport({
      year: 2026,
      annualDays: 12,
      employees: [
        { id: "1", displayName: "Nguyễn An", department: "Kế toán", employmentStatus: "official", officialDate: "2026-08-01" },
        { id: "2", displayName: "Trần Bình", employmentStatus: "probation" },
      ],
      applications: [
        { employeeId: "1", status: "approved", approvalType: "justified", chargeableDays: 2 },
        { employeeId: "1", status: "pending", chargeableDays: 1 },
        { employeeId: "1", status: "approved", approvalType: "unjustified", chargeableDays: 3 },
      ],
    });

    expect(report).toEqual([
      { employeeName: "Nguyễn An", department: "Kế toán", entitlement: 5, used: 2, pending: 1, unexcused: 3, remaining: 3 },
      { employeeName: "Trần Bình", entitlement: 0, used: 0, pending: 0, unexcused: 0, remaining: 0 },
    ]);
  });
});
