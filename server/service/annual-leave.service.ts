import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { listWorkingDates } from "./company-work-calendar.service";

export type EmploymentStatus = "official" | "probation" | "internship";

export function calculateAnnualLeaveEntitlement(input: {
  annualDays: number;
  employmentStatus?: EmploymentStatus;
  officialMonth?: number;
}): number {
  if (input.employmentStatus !== "official") return 0;
  const officialMonth = input.officialMonth || 1;
  if (!Number.isInteger(officialMonth) || officialMonth < 1 || officialMonth > 12) return 0;
  return Math.max(0, Math.floor(Math.max(0, input.annualDays) * (13 - officialMonth) / 12));
}

export function selectChargeableWorkingDates(dates: string[], workingDates: Set<string>): string[] {
  return dates.filter((date) => workingDates.has(date));
}

export async function getEmployeeAnnualLeaveBalance(employeeId: string, companyCode: string, year: number) {
  const [company, employee] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("annualLeaveDays").lean(),
    UserModel.findOne({ _id: employeeId, companyCode }).select("role employmentStatus officialDate workHoursConfig").lean(),
  ]);
  const config = employee?.workHoursConfig as any;
  const status = (employee?.employmentStatus || config?.employmentStatus || "official") as EmploymentStatus;
  const officialDate = employee?.officialDate || config?.officialDate;
  const officialMonth = officialDate ? new Date(officialDate).getUTCMonth() + 1 : 1;
  const annualDays = config?.annualLeaveDays ?? company?.annualLeaveDays ?? 12;
  const entitlement = calculateAnnualLeaveEntitlement({ annualDays, employmentStatus: status, officialMonth });
  const applications = await HRLeaveApplicationModel.find({ companyCode, employeeId, year, status: { $in: ["pending", "approved"] } }).select("status approvalType chargeableDays").lean();
  const used = applications.filter((item) => item.status === "approved" && item.approvalType === "justified").reduce((sum, item) => sum + (item.chargeableDays || 0), 0);
  const pending = applications.filter((item) => item.status === "pending").reduce((sum, item) => sum + (item.chargeableDays || 0), 0);
  const unexcused = applications.filter((item) => item.status === "approved" && item.approvalType === "unjustified").reduce((sum, item) => sum + (item.chargeableDays || 0), 0);
  return { year, entitlement, used, pending, unexcused, remaining: Math.max(0, entitlement - used) };
}

export async function calculateChargeableDates(companyCode: string, start: string, end: string): Promise<string[]> {
  return listWorkingDates(companyCode, start, end);
}