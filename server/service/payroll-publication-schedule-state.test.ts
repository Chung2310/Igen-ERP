import { describe, expect, it } from "vitest";
import { duePublicationPeriods, validatePublicationSchedule } from "./payroll-publication-schedule-state";
const schedule = { enabled: true, day: 15, hour: 9, minute: 30, periodOffset: 0 as const, version: 0, effectiveFrom: "2026-09-01T00:00:00Z" };
describe("payroll publication calendar", () => {
  it("waits for the configured Vietnam time, independent of host timezone", () => {
    expect(duePublicationPeriods(schedule, new Date("2026-09-15T02:29:59Z"))).toEqual([]);
    expect(duePublicationPeriods(schedule, new Date("2026-09-15T02:30:00Z"))).toEqual(["2026-09"]);
  });
  it("clamps the selected day to the last day in short and leap months", () => {
    for (const [year, day] of [[2026, 28], [2028, 29]]) {
      const config = { ...schedule, day: 31, effectiveFrom: `${year}-02-01T00:00:00Z` };
      expect(duePublicationPeriods(config, new Date(`${year}-02-${day}T02:29:59Z`))).toEqual([]);
      expect(duePublicationPeriods(config, new Date(`${year}-02-${day}T02:30:00Z`))).toEqual([`${year}-02`]);
    }
  });
  it("selects the previous salary month across year boundaries", () => {
    expect(duePublicationPeriods({ ...schedule, day: 1, hour: 0, minute: 0, periodOffset: -1, effectiveFrom: "2025-12-31T17:00:00Z" }, new Date("2025-12-31T17:00:00Z"))).toEqual(["2025-12"]);
  });
  it("catches up missed months after restart and permits enabling after this month's due time", () => {
    expect(duePublicationPeriods(schedule, new Date("2026-11-16T00:00:00Z"))).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(duePublicationPeriods({ ...schedule, effectiveFrom: "2026-09-20T00:00:00Z" }, new Date("2026-09-21T00:00:00Z"))).toEqual(["2026-09"]);
    expect(duePublicationPeriods({ ...schedule, enabled: false }, new Date("2026-11-16T00:00:00Z"))).toEqual([]);
  });
  it.each([{ day: 0 }, { day: 32 }, { day: 1.5 }, { hour: 24 }, { minute: 60 }, { periodOffset: 1 }, { enabled: "true" }, { version: -1 }])("rejects invalid configuration %j", change => {
    expect(() => validatePublicationSchedule({ ...schedule, ...change })).toThrow("Lịch không hợp lệ");
  });
});
