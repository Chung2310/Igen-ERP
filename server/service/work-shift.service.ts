import { Types } from "mongoose";
import { CompanyModel } from "../model/company.model";
import { ShiftAssignmentModel, WorkShiftModel } from "../model/work-shift.model";
import { UserModel } from "../model/user.model";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const minutesOf = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
export const vietnamWorkDate = (value = new Date()) => new Date(value.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00.000Z`).getUTCDay();

export function scheduledAt(workDate: string, time: string, nextDay = false): Date {
  const [year, month, day] = workDate.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day + (nextDay ? 1 : 0), hour - 7, minute));
}

export function calculateStandardMinutes(startTime: string, endTime: string, breaks: { startTime: string; endTime: string; paid?: boolean }[] = []) {
  let gross = minutesOf(endTime) - minutesOf(startTime);
  if (gross <= 0) gross += 1440;
  const unpaid = breaks.filter((item) => !item.paid).reduce((total, item) => {
    let duration = minutesOf(item.endTime) - minutesOf(item.startTime);
    if (duration < 0) duration += 1440;
    return total + duration;
  }, 0);
  return Math.max(1, gross - unpaid);
}

export type WorkHoursConfig = {
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
};

// Giờ làm cấu hình rời (của nhân viên hoặc của công ty) được dựng thành cùng một
// hình dạng với WorkShift để mọi nơi tiêu thụ chỉ cần đọc shift, không cần biết nguồn.
export function buildConfigWorkShift(config: WorkHoursConfig, code: string, name: string) {
  const startTime = config.checkInLimit || "08:30";
  const endTime = config.checkOutLimit || "17:30";
  const breakPeriods = config.lunchBreakStart && config.lunchBreakEnd
    ? [{ name: "Nghỉ trưa", startTime: config.lunchBreakStart, endTime: config.lunchBreakEnd, paid: false }]
    : [];
  return { _id: undefined, code, name, startTime, endTime,
    crossesMidnight: minutesOf(endTime) <= minutesOf(startTime), breakPeriods,
    allowedLateMinutes: 0, allowedEarlyLeaveMinutes: 0,
    standardMinutes: calculateStandardMinutes(startTime, endTime, breakPeriods),
    workingDays: config.workingDays?.length ? config.workingDays : [1, 2, 3, 4, 5], isDefault: true, isActive: true };
}

export type ResolveShiftSources = {
  customWorkHours: () => Promise<WorkHoursConfig | undefined>;
  assignment: () => Promise<{ _id?: unknown; shiftId: unknown } | null>;
  assignedShift: (shiftId: unknown) => Promise<any>;
  companyShift: () => Promise<any>;
  companyWorkHours: () => Promise<WorkHoursConfig | undefined>;
};

// Thứ tự ưu tiên nghiệp vụ: giờ làm việc riêng của nhân viên > ca được phân >
// ca mặc định công ty > cấu hình giờ làm chung của công ty.
export async function resolveShiftFromSources(sources: ResolveShiftSources) {
  const custom = await sources.customWorkHours();
  if (custom) {
    return { shift: buildConfigWorkShift(custom, "CUSTOM", "Giờ làm việc riêng"), source: "custom" as const };
  }

  const assignment = await sources.assignment();
  const assigned = assignment ? await sources.assignedShift(assignment.shiftId) : null;
  if (assigned) return { shift: assigned, source: "employee" as const, assignmentId: assignment?._id };

  const companyShift = await sources.companyShift();
  if (companyShift) return { shift: companyShift, source: "company" as const };

  return {
    shift: buildConfigWorkShift(await sources.companyWorkHours() ?? {}, "LEGACY", "Giờ làm việc công ty"),
    source: "legacy" as const,
  };
}

export async function resolveShift(companyCode: string, employeeId: string, workDate: string) {
  const weekday = weekdayOf(workDate);
  return resolveShiftFromSources({
    customWorkHours: async () => {
      if (!Types.ObjectId.isValid(employeeId)) return undefined;
      const user = await UserModel.findById(employeeId).select("workHoursConfig").lean();
      return user?.workHoursConfig?.useCustom ? user.workHoursConfig : undefined;
    },
    assignment: async () => ShiftAssignmentModel.findOne({
      companyCode, employeeId, effectiveFrom: { $lte: workDate },
      $or: [{ effectiveTo: null }, { effectiveTo: "" }, { effectiveTo: { $gte: workDate } }],
      daysOfWeek: weekday,
    }).sort({ effectiveFrom: -1 }).lean(),
    assignedShift: async (shiftId) => WorkShiftModel.findOne({ _id: shiftId as any, companyCode, isActive: true }).lean(),
    companyShift: async () => WorkShiftModel.findOne({ companyCode, isDefault: true, isActive: true }).lean(),
    companyWorkHours: async () => (
      await CompanyModel.findOne({ code: companyCode }).select("locationConfig").lean()
    )?.locationConfig,
  });
}

export function shiftWindow(shift: any, workDate: string) {
  const scheduledStartAt = scheduledAt(workDate, shift.startTime);
  const scheduledEndAt = scheduledAt(workDate, shift.endTime, shift.crossesMidnight || minutesOf(shift.endTime) <= minutesOf(shift.startTime));
  return { scheduledStartAt, scheduledEndAt };
}
