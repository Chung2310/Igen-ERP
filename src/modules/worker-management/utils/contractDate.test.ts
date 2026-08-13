import { describe, expect, it } from "vitest";
import {
  alertText,
  daysUntil,
  parseFlexibleDate,
  resolveAlertLevel,
  toDisplayDate,
  toIsoDate,
} from "./contractDate";

const TODAY = new Date(2026, 7, 13); // 13/08/2026

describe("contract date utils", () => {
  it("parses both the stored and the typed date format", () => {
    expect(parseFlexibleDate("2026-08-13")?.getMonth()).toBe(7);
    expect(parseFlexibleDate("13/08/2026")?.getDate()).toBe(13);
    expect(parseFlexibleDate("linh tinh")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
  });

  it("converts between display and stored formats", () => {
    expect(toDisplayDate("2026-08-13")).toBe("13/08/2026");
    expect(toIsoDate("13/08/2026")).toBe("2026-08-13");
    expect(toIsoDate("2026-08-13")).toBe("2026-08-13");
  });

  it("counts calendar days to the deadline", () => {
    expect(daysUntil("2026-08-20", TODAY)).toBe(7);
    expect(daysUntil("2026-08-13", TODAY)).toBe(0);
    expect(daysUntil("2026-08-01", TODAY)).toBe(-12);
    expect(daysUntil(undefined, TODAY)).toBeNull();
  });

  it.each([
    ["2026-09-14", "ok"],
    ["2026-09-12", "expiring"],
    ["2026-08-13", "expiring"],
    ["2026-08-12", "expired"],
  ])("flags %s as %s", (endDate, expected) => {
    expect(resolveAlertLevel(endDate, "active", TODAY)).toBe(expected);
  });

  it("does not warn about periods already renewed or terminated", () => {
    expect(resolveAlertLevel("2026-01-01", "renewed", TODAY)).toBe("ok");
    expect(resolveAlertLevel("2026-01-01", "terminated", TODAY)).toBe("ok");
  });

  it("phrases the remaining time for humans", () => {
    expect(alertText("2026-08-20", TODAY)).toBe("Còn 7 ngày");
    expect(alertText("2026-08-13", TODAY)).toBe("Hết hạn hôm nay");
    expect(alertText("2026-08-10", TODAY)).toBe("Quá hạn 3 ngày");
  });
});
