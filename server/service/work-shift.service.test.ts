import { describe, expect, it } from "vitest";
import { calculateStandardMinutes, scheduledAt, shiftWindow, vietnamWorkDate, weekdayOf } from "./work-shift.service";

describe("work shift time calculations", () => {
  it("calculates a daytime shift excluding unpaid breaks", () => {
    expect(calculateStandardMinutes("08:00", "17:00", [{ startTime: "12:00", endTime: "13:00", paid: false }])).toBe(480);
  });

  it("calculates a shift crossing midnight", () => {
    expect(calculateStandardMinutes("22:00", "06:00", [])).toBe(480);
    const window = shiftWindow({ startTime: "22:00", endTime: "06:00", crossesMidnight: true }, "2026-08-05");
    expect(window.scheduledEndAt.getTime() - window.scheduledStartAt.getTime()).toBe(8 * 60 * 60 * 1000);
  });

  it("creates schedule instants in Vietnam time", () => {
    expect(scheduledAt("2026-08-05", "08:00").toISOString()).toBe("2026-08-05T01:00:00.000Z");
    expect(weekdayOf("2026-08-09")).toBe(0);
    expect(vietnamWorkDate(new Date("2026-08-05T18:00:00.000Z"))).toBe("2026-08-06");
  });
});
