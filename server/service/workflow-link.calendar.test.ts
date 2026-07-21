import { describe, expect, it, vi } from "vitest";

vi.mock("./company-work-calendar.service", () => ({
  listWorkingDates: vi.fn(async (_companyCode: string, start: string, end: string) => {
    const holidays = new Set(["2026-04-30", "2026-05-01", "2026-01-01"]);
    const saturdayOverride = new Set(["2026-05-16"]);
    const dates: string[] = [];
    for (let d = new Date(`${start}T00:00:00`); d <= new Date(`${end}T00:00:00`); d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const day = d.getDay();
      const isWeekend = day === 0 || day === 6;
      if (holidays.has(key)) continue;
      if (saturdayOverride.has(key)) {
        dates.push(key);
        continue;
      }
      if (!isWeekend) dates.push(key);
    }
    return dates;
  }),
}));

import { buildWorkingDaySet, calculateStepSchedule } from "./workflow-link.service";

describe("calendar-aware workflow scheduling", () => {
  it("skips a deadline spanning the 30/4-1/5 holiday block", async () => {
    const workingSet = await buildWorkingDaySet("IGEN", new Date("2026-04-29T08:00:00"));
    const schedule = calculateStepSchedule(
      { steps: [{ id: "s1", estDays: 2, deadlineTime: "18:00" }] },
      { startDate: "2026-04-29" },
      workingSet
    );
    const window = schedule.get("s1")!;
    expect(window.start.getDate()).toBe(29);
    // 29/4 (Wed) + 1 more working day, skipping 30/4 & 1/5 holidays and the weekend -> 4/5 (Mon)
    expect(window.due!.getMonth()).toBe(4);
    expect(window.due!.getDate()).toBe(4);
  });

  it("treats an admin-enabled Saturday working override as a working day", async () => {
    const workingSet = await buildWorkingDaySet("IGEN", new Date("2026-05-15T08:00:00"));
    expect(workingSet.has("2026-05-16")).toBe(true);
  });

  it("excludes a disabled holiday's date from the non-working set when it is not applied", async () => {
    const workingSet = await buildWorkingDaySet("IGEN", new Date("2026-01-01T08:00:00"));
    expect(workingSet.has("2026-01-01")).toBe(false);
  });

  it("chains multiple workflow steps sequentially, each skipping holidays independently", async () => {
    const workingSet = await buildWorkingDaySet("IGEN", new Date("2026-04-28T08:00:00"));
    const schedule = calculateStepSchedule(
      {
        steps: [
          { id: "s1", estDays: 1, deadlineTime: "18:00" },
          { id: "s2", estDays: 1, deadlineTime: "18:00" },
        ],
      },
      { startDate: "2026-04-28" },
      workingSet
    );
    const s1 = schedule.get("s1")!;
    const s2 = schedule.get("s2")!;
    expect(s2.start.getTime()).toBeGreaterThan(s1.due!.getTime());
    expect(s2.start.getDate()).not.toBe(30);
  });
});
