import { describe, expect, it } from "vitest";
import {
  emptyDatePeriodFilter,
  formatDateVi,
  formatMonthVi,
  formatPeriodSummary,
  getCurrentMonthString,
  getDatePeriodRange,
  getLastMonthString,
  getMonthDateRange,
  getTodayDateString,
  isDateInPeriod,
  type DatePeriodFilterValue,
} from "./datePeriodFilter";

describe("datePeriodFilter utils", () => {
  it("generates correct month ranges for leap and regular months", () => {
    expect(getMonthDateRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(getMonthDateRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(getMonthDateRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(getMonthDateRange("invalid")).toBeNull();
  });

  it("extracts date period ranges for each mode", () => {
    expect(getDatePeriodRange(emptyDatePeriodFilter())).toEqual({});

    const dayFilter: DatePeriodFilterValue = {
      mode: "day",
      day: "2026-10-31",
      month: "",
      from: "",
      to: "",
    };
    expect(getDatePeriodRange(dayFilter)).toEqual({ from: "2026-10-31", to: "2026-10-31" });

    const monthFilter: DatePeriodFilterValue = {
      mode: "month",
      month: "2026-09",
      day: "",
      from: "",
      to: "",
    };
    expect(getDatePeriodRange(monthFilter)).toEqual({ from: "2026-09-01", to: "2026-09-30" });

    const rangeFilter: DatePeriodFilterValue = {
      mode: "range",
      from: "2026-10-01",
      to: "2026-10-15",
      day: "",
      month: "",
    };
    expect(getDatePeriodRange(rangeFilter)).toEqual({ from: "2026-10-01", to: "2026-10-15" });
  });

  it("checks whether dates fall inside a period", () => {
    const range = { from: "2026-10-10", to: "2026-10-20" };
    expect(isDateInPeriod("2026-10-15T08:00:00.000Z", range)).toBe(true);
    expect(isDateInPeriod("2026-10-05T08:00:00.000Z", range)).toBe(false);
    expect(isDateInPeriod("2026-10-25T08:00:00.000Z", range)).toBe(false);
    expect(isDateInPeriod("2026-10-10T00:00:00+07:00", range)).toBe(true);
  });

  it("formats Vietnamese dates and month labels nicely", () => {
    expect(formatDateVi("2026-10-31")).toBe("31/10/2026");
    expect(formatMonthVi("2026-10")).toBe("Tháng 10/2026");
  });

  it("summarizes periods accurately", () => {
    expect(formatPeriodSummary(emptyDatePeriodFilter())).toBe("Tất cả thời gian");

    const todayStr = getTodayDateString();
    expect(
      formatPeriodSummary({ mode: "day", day: todayStr, month: "", from: "", to: "" }),
    ).toContain("Hôm nay");

    const currMonthStr = getCurrentMonthString();
    expect(
      formatPeriodSummary({ mode: "month", month: currMonthStr, day: "", from: "", to: "" }),
    ).toContain("Tháng này");

    const lastMonthStr = getLastMonthString();
    expect(
      formatPeriodSummary({ mode: "month", month: lastMonthStr, day: "", from: "", to: "" }),
    ).toContain("Tháng trước");

    expect(
      formatPeriodSummary({ mode: "range", from: "2026-10-01", to: "2026-10-15", day: "", month: "" }),
    ).toBe("01/10/2026 - 15/10/2026");
  });
});

