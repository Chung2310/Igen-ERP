import { describe, expect, it } from "vitest";
import { summarizeDepartmentPayroll } from "./hrPayrollOverview";

describe("summarizeDepartmentPayroll", () => {
  it("ranks salary funds and counts employees without an updated salary as zero", () => {
    expect(summarizeDepartmentPayroll(
      [{ uid: "a", department: "Kinh doanh", monthlySalary: 30_000_000 }, { uid: "b", department: "Kinh doanh" }, { uid: "c", department: "Kế toán", monthlySalary: 20_000_000 }],
    )).toEqual([
      { name: "Kinh doanh", total: 30_000_000, average: 15_000_000, count: 2 },
      { name: "Kế toán", total: 20_000_000, average: 20_000_000, count: 1 },
    ]);
  });
});
