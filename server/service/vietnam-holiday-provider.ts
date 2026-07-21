import type { HolidayBaselineDay } from "../interface/company-work-calendar.interface";

export class UnsupportedHolidayYearError extends Error {
  constructor(year: number) {
    super(`Chưa có lịch nghỉ lễ chính thức được kiểm duyệt cho năm ${year}.`);
    this.name = "UnsupportedHolidayYearError";
  }
}

const holiday = (sourceKey: string, date: string, name: string, dayType: HolidayBaselineDay["dayType"] = "holiday"): HolidayBaselineDay => ({
  sourceKey,
  sourceYear: Number(date.slice(0, 4)),
  date,
  name,
  dayType,
});

export const VIETNAM_HOLIDAYS_BY_YEAR: Readonly<Record<number, readonly HolidayBaselineDay[]>> = {
  2026: [
    holiday("new-year-2026", "2026-01-01", "Tết Dương lịch"),
    holiday("tet-2026-1", "2026-02-16", "Tết Nguyên đán - ngày 1"),
    holiday("tet-2026-2", "2026-02-17", "Tết Nguyên đán - ngày 2"),
    holiday("tet-2026-3", "2026-02-18", "Tết Nguyên đán - ngày 3"),
    holiday("tet-2026-4", "2026-02-19", "Tết Nguyên đán - ngày 4"),
    holiday("tet-2026-5", "2026-02-20", "Tết Nguyên đán - ngày 5"),
    holiday("hung-kings-2026", "2026-04-26", "Giỗ Tổ Hùng Vương"),
    holiday("hung-kings-substitute-2026", "2026-04-27", "Nghỉ bù Giỗ Tổ Hùng Vương", "substitute_holiday"),
    holiday("reunification-2026", "2026-04-30", "Ngày Chiến thắng"),
    holiday("labour-day-2026", "2026-05-01", "Ngày Quốc tế Lao động"),
    holiday("national-day-2026-1", "2026-09-01", "Nghỉ lễ Quốc khánh"),
    holiday("national-day-2026-2", "2026-09-02", "Ngày Quốc khánh"),
  ],
};

export function getVietnamHolidayBaseline(year: number): HolidayBaselineDay[] {
  const baseline = VIETNAM_HOLIDAYS_BY_YEAR[year];
  if (!baseline) throw new UnsupportedHolidayYearError(year);
  return baseline.map((item) => ({ ...item }));
}
