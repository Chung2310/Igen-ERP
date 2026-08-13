import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CalendarTab.tsx", import.meta.url), "utf8");

describe("CalendarTab attendance mode wiring", () => {
  it("defaults attendance history to the daily overview", () => {
    expect(source).toContain('useState<"overview" | "detail">("overview")');
    expect(source).toContain("<AttendanceDailyOverview");
  });

  it("allows switching between overview and monthly detail", () => {
    expect(source).toContain('setAttendanceSectionMode("overview")');
    expect(source).toContain('setAttendanceSectionMode("detail")');
    expect(source).toContain('attendanceSectionMode === "overview"');
  });

  it("loads the selected overview date", () => {
    expect(source).toContain("attendanceOverviewDate");
    expect(source).toContain("startDate = attendanceOverviewDate");
    expect(source).toContain("endDate = attendanceOverviewDate");
  });
});
