import { CompanyModel } from "../model/company.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { UserModel } from "../model/user.model";
import { buildBranchRosterFilter } from "../utils/branch-roster-filter";
import { calculateAnnualLeaveEntitlement, type EmploymentStatus } from "./annual-leave.service";

export interface LeaveBalanceEmployee {
  id: string;
  displayName: string;
  department?: string;
  employmentStatus?: EmploymentStatus;
  officialDate?: Date | string;
  workHoursConfig?: { annualLeaveDays?: number; employmentStatus?: EmploymentStatus; officialDate?: Date | string };
}

export interface LeaveBalanceApplication {
  employeeId: string;
  status: "pending" | "approved" | "rejected";
  approvalType?: "justified" | "unjustified";
  chargeableDays?: number;
}

export interface LeaveBalanceReportRow {
  employeeName: string;
  department?: string;
  entitlement: number;
  used: number;
  pending: number;
  unexcused: number;
  remaining: number;
}

export function buildLeaveBalanceReport(input: {
  year: number;
  annualDays: number;
  employees: LeaveBalanceEmployee[];
  applications: LeaveBalanceApplication[];
}): LeaveBalanceReportRow[] {
  const applicationsByEmployee = new Map<string, LeaveBalanceApplication[]>();
  for (const application of input.applications) {
    const current = applicationsByEmployee.get(application.employeeId) || [];
    current.push(application);
    applicationsByEmployee.set(application.employeeId, current);
  }

  return input.employees.map((employee) => {
    const config = employee.workHoursConfig;
    const status = employee.employmentStatus || config?.employmentStatus || "official";
    const officialDate = employee.officialDate || config?.officialDate;
    const officialMonth = officialDate ? new Date(officialDate).getUTCMonth() + 1 : 1;
    const annualDays = config?.annualLeaveDays ?? input.annualDays;
    const entitlement = calculateAnnualLeaveEntitlement({ annualDays, employmentStatus: status, officialMonth });
    const applications = applicationsByEmployee.get(employee.id) || [];
    const used = applications.filter((item) => item.status === "approved" && item.approvalType === "justified")
      .reduce((sum, item) => sum + (item.chargeableDays || 0), 0);
    const pending = applications.filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + (item.chargeableDays || 0), 0);
    const unexcused = applications.filter((item) => item.status === "approved" && item.approvalType === "unjustified")
      .reduce((sum, item) => sum + (item.chargeableDays || 0), 0);

    return {
      employeeName: employee.displayName,
      ...(employee.department ? { department: employee.department } : {}),
      entitlement,
      used,
      pending,
      unexcused,
      remaining: Math.max(0, entitlement - used),
    };
  }).sort((left, right) => left.employeeName.localeCompare(right.employeeName, "vi"));
}

export async function listCompanyAnnualLeaveBalances(companyCode: string, branchId: string | undefined, year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Năm tính phép không hợp lệ.");

  const scope = { companyCode, ...buildBranchRosterFilter(branchId), disabledAt: null, isActive: { $ne: false }, role: { $ne: "superadmin" } };
  const [company, employeeRecords] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("annualLeaveDays").lean(),
    UserModel.find(scope)
      .select("displayName department employmentStatus officialDate workHoursConfig")
      .sort({ displayName: 1 })
      .lean(),
  ]);
  const employees: LeaveBalanceEmployee[] = employeeRecords.map((employee: any) => ({
    id: String(employee._id),
    displayName: String(employee.displayName || ""),
    department: employee.department,
    employmentStatus: employee.employmentStatus,
    officialDate: employee.officialDate,
    workHoursConfig: employee.workHoursConfig,
  }));
  const employeeIds = employees.map((employee) => employee.id);
  const applications = employeeIds.length
    ? await HRLeaveApplicationModel.find({ companyCode, employeeId: { $in: employeeIds }, year, status: { $in: ["pending", "approved"] } })
      .select("employeeId status approvalType chargeableDays")
      .lean()
    : [];

  const balances = buildLeaveBalanceReport({
    year,
    annualDays: company?.annualLeaveDays ?? 12,
    employees,
    applications: applications.map((item: any) => ({
      employeeId: String(item.employeeId),
      status: item.status,
      approvalType: item.approvalType,
      chargeableDays: item.chargeableDays,
    })),
  });
  return { year, balances };
}
