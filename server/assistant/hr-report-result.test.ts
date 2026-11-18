import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { projectRecords } from "./executor";
import { formatAssistantResult } from "./result-format";

function operation(id: string) {
  const found = ASSISTANT_OPERATIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing operation ${id}`);
  return found;
}

describe("HR assistant report results", () => {
  it("renders a monthly attendance report as a Vietnamese table with fractional workdays", () => {
    const reply = formatAssistantResult(operation("timekeeping.records.monthly.under-threshold"), {
      status: "success",
      data: { year: 2026, month: 10, thresholdDays: 26, records: [{ employeeName: "Nguyễn An", workedDays: 20.5, absentDays: 1, leaveDays: 2, daysOff: 3, lateDays: 1, leftEarlyDays: 0 }] },
    });

    expect(reply).toContain("20,5");
    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("Nghỉ phép");
    expect(reply).not.toContain("employeeId");
  });

  it("filters annual leave results using the requested balance rule", () => {
    const reply = formatAssistantResult(operation("leave.balances.minimum"), {
      status: "success",
      data: { year: 2026, thresholdDays: 12, balances: [
        { employeeName: "Nguyễn An", entitlement: 12, used: 0, pending: 0, unexcused: 0, remaining: 12 },
        { employeeName: "Trần Bình", entitlement: 12, used: 3, pending: 0, unexcused: 0, remaining: 9 },
      ] },
    });

    expect(reply).toContain("Nguyễn An");
    expect(reply).not.toContain("Trần Bình");
  });

  it("filters training progress by the requested course name rather than a fixed course", () => {
    const trainingOperation = operation("hr.training.incomplete.list");
    const records = projectRecords(trainingOperation, { status: "success", data: [
      { userName: "Nguyễn An", courseTitle: "Quy chế bảo mật", status: "in_progress", progress: 50 },
      { userName: "Trần Bình", courseTitle: "An toàn lao động", status: "not_started", progress: 0 },
    ], total: 2 }, {} as any, { courseName: "quy che bao mat" });
    const reply = formatAssistantResult(trainingOperation, records[0]);

    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("Quy chế bảo mật");
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

  it("ranks any requested approved leave type by its recorded duration", () => {
    const leaveOperation = operation("hr.leave.applications.list");
    const records = projectRecords(leaveOperation, { status: "success", data: { items: [
      { employeeId: "507f1f77bcf86cd799439011", employeeName: "Nguyễn An", requestKind: "leave", startDate: "2026-10-05T00:00:00.000Z", endDate: "2026-10-06T00:00:00.000Z", chargeableDays: 2, status: "approved" },
      { employeeId: "507f1f77bcf86cd799439012", employeeName: "Trần Bình", requestKind: "leave", startDate: "2026-10-09T00:00:00.000Z", endDate: "2026-10-10T00:00:00.000Z", chargeableDays: 1, status: "approved" },
    ] } }, {} as any, { reportKind: "leave-most" });
    const reply = formatAssistantResult(leaveOperation, records[0]);

    expect(reply).toContain("Nguyễn An");
    expect(reply).toContain("2");
    expect(reply).not.toContain("Trần Bình");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });

  it("renders the custom calendar event title and Vietnam-local time in the shared table", () => {
    const calendarOperation = operation("hr.calendar.events.list");
    const records = projectRecords(calendarOperation, { status: "success", data: { items: [
      { _id: "507f1f77bcf86cd799439011", title: "Họp tổng kết tuần", type: "meeting", startDate: "2026-11-21T00:00:00.000+07:00", endDate: "2026-11-21T01:00:00.000+07:00", status: "approved" },
    ] } }, {} as any, {});
    const reply = formatAssistantResult(calendarOperation, records);

    expect(records[0].id).toBe("507f1f77bcf86cd799439011");
    expect(reply).toContain("Họp tổng kết tuần");
    expect(reply).toContain("21/11/2026");
    expect(reply).toContain("00:00");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });

  it("filters monthly task KPI rows using the requested completion threshold", () => {
    const kpiOperation = operation("task.kpi.monthly");
    const records = projectRecords(kpiOperation, { status: "success", data: { periodKey: "2026-10", periodStatus: "closed", rows: [
      { employeeName: "Nguyễn An", totalTasks: 4, completedTasks: 4, pendingTasks: 0, percent: 100 },
      { employeeName: "Trần Bình", totalTasks: 5, completedTasks: 3, pendingTasks: 2, percent: 60 },
      { employeeName: "Lê Chưa Giao Việc", totalTasks: 0, completedTasks: 0, pendingTasks: 0, percent: null },
    ] } }, {} as any, { period: "2026-10", completionFilter: "below-100" });
    const reply = formatAssistantResult(kpiOperation, records[0]);

    expect(reply).toContain("Trần Bình");
    expect(reply).toContain("60%");
    expect(reply).not.toContain("Nguyễn An");
    expect(reply).not.toContain("Lê Chưa Giao Việc");
  });

  it("filters calendar results supplied as a raw API list and hides internal IDs", () => {
    const calendarOperation = operation("hr.calendar.events.list");
    const reply = formatAssistantResult(calendarOperation, [{
      _id: "507f1f77bcf86cd799439011", title: "Họp tổng kết tuần", type: "meeting",
      startDate: "2026-11-21T00:00:00.000+07:00", status: "approved",
    }]);

    expect(reply).toContain("Họp tổng kết tuần");
    expect(reply).toContain("21/11/2026");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });
});
