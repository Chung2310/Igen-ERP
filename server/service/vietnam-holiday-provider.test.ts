import { describe, expect, it } from "vitest";
import {
  UnsupportedHolidayYearError,
  getVietnamHolidayBaseline,
} from "./vietnam-holiday-provider";

describe("getVietnamHolidayBaseline", () => {
  it("returns the reviewed 2026 Vietnam holiday baseline with stable unique keys", () => {
    const holidays = getVietnamHolidayBaseline(2026);

    expect(new Set(holidays.map((holiday) => holiday.sourceKey)).size).toBe(holidays.length);
    expect(holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "new-year-2026", date: "2026-01-01", dayType: "holiday" }),
      expect.objectContaining({ sourceKey: "tet-2026-1", date: "2026-02-16" }),
      expect.objectContaining({ sourceKey: "tet-2026-5", date: "2026-02-20" }),
      expect.objectContaining({ sourceKey: "hung-kings-2026", date: "2026-04-26" }),
      expect.objectContaining({ sourceKey: "hung-kings-substitute-2026", date: "2026-04-27", dayType: "substitute_holiday" }),
      expect.objectContaining({ sourceKey: "reunification-2026", date: "2026-04-30" }),
      expect.objectContaining({ sourceKey: "labour-day-2026", date: "2026-05-01" }),
      expect.objectContaining({ sourceKey: "national-day-2026-1", date: "2026-09-01" }),
      expect.objectContaining({ sourceKey: "national-day-2026-2", date: "2026-09-02" }),
    ]));
    expect(holidays.filter((holiday) => holiday.sourceKey.startsWith("tet-2026-"))).toHaveLength(5);
  });

  it("rejects years without a reviewed official baseline", () => {
    expect(() => getVietnamHolidayBaseline(2027)).toThrow(UnsupportedHolidayYearError);
  });
});
