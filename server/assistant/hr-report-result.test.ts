import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { formatAssistantResult } from "./result-format";

function operation(id: string) {
  const found = ASSISTANT_OPERATIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing operation ${id}`);
  return found;
}

describe("HR assistant report results", () => {
  it("renders a monthly attendance report as a Vietnamese table with fractional workdays", () => {
    const reply = formatAssistantResult(operation("timekeeping.records.monthly.under-26"), {
      status: "success",
      data: { year: 2026, month: 10, records: [{ employeeName: "Nguyễn An", workedDays: 20.5, absentDays: 1, leaveDays: 2, daysOff: 3, lateDays: 1, leftEarlyDays: 0 }] },
    });

    expect(reply).toContain("20,5");
    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("Nghỉ phép");
    expect(reply).not.toContain("employeeId");
  });

  it("filters annual leave results using the requested balance rule", () => {
    const reply = formatAssistantResult(operation("leave.balances.at-least-12"), {
      status: "success",
      data: { year: 2026, balances: [
        { employeeName: "Nguyễn An", entitlement: 12, used: 0, pending: 0, unexcused: 0, remaining: 12 },
        { employeeName: "Trần Bình", entitlement: 12, used: 3, pending: 0, unexcused: 0, remaining: 9 },
      ] },
    });

    expect(reply).toContain("Nguyễn An");
    expect(reply).not.toContain("Trần Bình");
  });

  it("renders only the selected month holiday records without internal identifiers", () => {
    const reply = formatAssistantResult(operation("timekeeping.work-calendar.month-holidays"), {
      status: "success",
      data: [{ id: "507f1f77bcf86cd799439011", date: "2026-11-20", name: "Ngày nghỉ công ty", dayTypeLabel: "Ngày nghỉ lễ", isApplied: true }],
    });

    expect(reply).toContain("Ngày nghỉ công ty");
    expect(reply).toContain("20/11/2026");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });
});
