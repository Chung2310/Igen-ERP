import { describe, expect, it } from "vitest";
import { countNewEmployeesInPeriod, getHrDashboardPeriodRange } from "./hrDashboardPeriod";

describe("bộ lọc nhân sự mới", () => {
  const now = new Date(2026, 9, 17, 10, 0);

  it("tính tuần này từ thứ Hai và tháng này từ ngày đầu tháng", () => {
    expect(getHrDashboardPeriodRange("week", "", now).start).toEqual(new Date(2026, 9, 12));
    expect(getHrDashboardPeriodRange("month", "", now).start).toEqual(new Date(2026, 9, 1));
  });

  it("lọc ngày chọn theo cả ngày và không tính bản ghi thiếu ngày tạo", () => {
    const employees = [
      { createdAt: new Date(2026, 9, 17, 0, 0).toISOString() },
      { createdAt: new Date(2026, 9, 17, 23, 59).toISOString() },
      { createdAt: new Date(2026, 9, 18, 0, 0).toISOString() },
    ];
    expect(countNewEmployeesInPeriod(employees, "date", "2026-10-17", now)).toBe(2);
    expect(countNewEmployeesInPeriod([{ createdAt: undefined }], "month", "", now)).toBeNull();
  });
});
