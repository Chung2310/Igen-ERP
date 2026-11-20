import { CompanyModel } from "../model/company.model";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";

type CalendarDay = { date: string; dayType: string; isApplied: boolean; branchId?: unknown };
type Employee = { _id: unknown; branchId?: unknown; workHoursConfig?: { useCustom?: boolean; workingDays?: number[] } };

type Dependencies = {
  listCalendarDays(companyCode: string, dates: string[]): Promise<CalendarDay[]>;
  listUsers(companyCode: string): Promise<Employee[]>;
  getCompanyWorkingDays(companyCode: string): Promise<number[]>;
  bulkWrite(operations: any[]): Promise<unknown>;
  deleteGenerated(companyCode: string, dates: string[], eligibleKeys: Set<string>): Promise<unknown>;
};

const branchValue = (value: unknown) => value == null ? "" : String(value);

export function createPaidHolidayAttendanceService(dependencies: Dependencies) {
  return {
    async reconcilePaidHolidayAttendance(companyCode: string, dates: string[]) {
      const uniqueDates = [...new Set(dates)].sort();
      if (!uniqueDates.length) return;
      const [calendarDays, users, companyWorkingDays] = await Promise.all([
        dependencies.listCalendarDays(companyCode, uniqueDates),
        dependencies.listUsers(companyCode),
        dependencies.getCompanyWorkingDays(companyCode),
      ]);
      const eligibleKeys = new Set<string>();
      const operations: any[] = [];

      for (const user of users) {
        const uid = String(user._id);
        const workingDays = user.workHoursConfig?.useCustom && user.workHoursConfig.workingDays?.length
          ? user.workHoursConfig.workingDays
          : companyWorkingDays;
        for (const date of uniqueDates) {
          const rules = calendarDays.filter((day) => day.date === date && (!branchValue(day.branchId) || branchValue(day.branchId) === branchValue(user.branchId)));
          const hasWorkingOverride = rules.some((day) => day.isApplied && day.dayType === "working_override");
          const isHoliday = !hasWorkingOverride && rules.some((day) => day.isApplied && day.dayType !== "working_override");
          const scheduled = workingDays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
          if (!isHoliday || !scheduled) continue;
          eligibleKeys.add(`${uid}|${date}`);
          operations.push({
            updateOne: {
              filter: { uid, date },
              update: { $setOnInsert: { uid, companyCode, branchId: branchValue(user.branchId) || undefined, date, status: "Paid-Holiday", note: rules[0]?.dayType === "substitute_holiday" ? "Nghỉ bù có lương" : "Nghỉ lễ có lương", assignmentSource: "holiday" } },
              upsert: true,
            },
          });
        }
      }

      await dependencies.deleteGenerated(companyCode, uniqueDates, eligibleKeys);
      if (operations.length) await dependencies.bulkWrite(operations);
    },
  };
}

const modelDependencies: Dependencies = {
  listCalendarDays: (companyCode, dates) => CompanyWorkCalendarDayModel.find({ companyCode, date: { $in: dates }, isApplied: true }).lean() as any,
  listUsers: (companyCode) => UserModel.find({ companyCode, isActive: { $ne: false }, role: { $ne: "superadmin" } }).select("_id branchId workHoursConfig").lean() as any,
  getCompanyWorkingDays: async (companyCode) => {
    const company = await CompanyModel.findOne({ code: companyCode }).select("locationConfig.workingDays").lean();
    return company?.locationConfig?.workingDays?.length ? company.locationConfig.workingDays : [1, 2, 3, 4, 5];
  },
  bulkWrite: (operations) => TimekeepingLogModel.bulkWrite(operations),
  deleteGenerated: async (companyCode, dates, eligibleKeys) => {
    const generated = await TimekeepingLogModel.find({ companyCode, date: { $in: dates }, assignmentSource: "holiday", manuallyAdjusted: { $ne: true } }).select("_id uid date").lean();
    const staleIds = generated.filter((row) => !eligibleKeys.has(`${row.uid}|${row.date}`)).map((row) => row._id);
    if (staleIds.length) await TimekeepingLogModel.deleteMany({ _id: { $in: staleIds }, assignmentSource: "holiday", manuallyAdjusted: { $ne: true } });
  },
};

const modelService = createPaidHolidayAttendanceService(modelDependencies);

export async function reconcilePaidHolidayAttendance(companyCode: string, dates?: string[]) {
  const targetDates = dates?.length
    ? dates
    : await CompanyWorkCalendarDayModel.distinct("date", { companyCode, isApplied: true, dayType: { $in: ["holiday", "substitute_holiday"] } });
  return modelService.reconcilePaidHolidayAttendance(companyCode, targetDates);
}

export async function backfillPaidHolidayAttendance() {
  const companyCodes = await CompanyWorkCalendarDayModel.distinct("companyCode", {
    isApplied: true,
    dayType: { $in: ["holiday", "substitute_holiday"] },
  });
  for (const companyCode of companyCodes.filter(Boolean)) {
    await reconcilePaidHolidayAttendance(String(companyCode));
  }
}
