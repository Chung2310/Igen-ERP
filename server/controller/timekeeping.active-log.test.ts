import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./timekeeping.controller.ts", import.meta.url), "utf8");

describe("timekeeping active-log wiring", () => {
  it("filters candidates consistently for status, check-in and check-out", () => {
    expect(source).toContain("active-attendance-log.service");
    expect(source.match(/isAttendanceLogActiveOnDate\(candidate, todayStr\)/g)).toHaveLength(3);
  });
});
