import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./CalendarTab.tsx", import.meta.url),
  "utf8"
);

describe("CalendarTab attendance Excel wiring", () => {
  it("wires both utility actions to attendance exports", () => {
    expect(source).toContain("AttendanceUtilityMenu");
    expect(source).toContain('handleAttendanceExcelExport("coeff")');
    expect(source).toContain('handleAttendanceExcelExport("hours")');
    expect(source).toContain("sidebarEmployees.map");
    expect(source).toContain("exportAttendanceExcel");
  });

  it("uses the filtered employee list rather than the paginated list", () => {
    expect(source).toContain("employees: exportEmployees");
    expect(source).not.toContain("employees: paginatedGridEmployees");
  });
});
