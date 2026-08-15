import { describe, expect, it } from "vitest";
import { calculateStandardMinutes, resolveShiftFromSources, scheduledAt, shiftWindow, vietnamWorkDate, weekdayOf } from "./work-shift.service";

const sources = (overrides: Partial<Parameters<typeof resolveShiftFromSources>[0]> = {}) => ({
  customWorkHours: async () => undefined,
  assignment: async () => null,
  assignedShift: async () => null,
  companyShift: async () => null,
  companyWorkHours: async () => undefined,
  ...overrides,
});

describe("shift resolution priority", () => {
  const custom = { checkInLimit: "13:00", checkOutLimit: "22:00", workingDays: [1, 2, 3, 4, 5, 6] };
  const assigned = { _id: "shift-assigned", code: "CA1", startTime: "06:00", endTime: "14:00" };
  const companyShift = { _id: "shift-company", code: "HC", startTime: "08:00", endTime: "17:00" };

  it("prefers the employee's own work hours over every shift record", async () => {
    const resolved = await resolveShiftFromSources(sources({
      customWorkHours: async () => custom,
      assignment: async () => ({ _id: "assign-1", shiftId: "shift-assigned" }),
      assignedShift: async () => assigned,
      companyShift: async () => companyShift,
    }));
    expect(resolved.source).toBe("custom");
    expect(resolved.shift).toMatchObject({ startTime: "13:00", endTime: "22:00", workingDays: [1, 2, 3, 4, 5, 6] });
  });

  it("falls back to the assigned shift before the company default", async () => {
    const resolved = await resolveShiftFromSources(sources({
      assignment: async () => ({ _id: "assign-1", shiftId: "shift-assigned" }),
      assignedShift: async () => assigned,
      companyShift: async () => companyShift,
    }));
    expect(resolved.source).toBe("employee");
    expect(resolved.shift).toBe(assigned);
  });

  it("falls back to the company default shift, then to the company work hours", async () => {
    expect(await resolveShiftFromSources(sources({ companyShift: async () => companyShift })))
      .toMatchObject({ source: "company", shift: companyShift });

    const legacy = await resolveShiftFromSources(sources({
      companyWorkHours: async () => ({ checkInLimit: "09:00", checkOutLimit: "18:00" }),
    }));
    expect(legacy.source).toBe("legacy");
    expect(legacy.shift).toMatchObject({ startTime: "09:00", endTime: "18:00", workingDays: [1, 2, 3, 4, 5] });
  });

  it("derives standard minutes and midnight crossing for configured work hours", async () => {
    const night = await resolveShiftFromSources(sources({
      customWorkHours: async () => ({ checkInLimit: "22:00", checkOutLimit: "06:00" }),
    }));
    expect(night.shift).toMatchObject({ crossesMidnight: true, standardMinutes: 480 });
  });
});

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
