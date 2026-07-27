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

export async function resolveShift(companyCode: string, employeeId: string, workDate: string) {
  const weekday = weekdayOf(workDate);
  const assignment = await ShiftAssignmentModel.findOne({
    companyCode, employeeId, effectiveFrom: { $lte: workDate },
    $or: [{ effectiveTo: null }, { effectiveTo: "" }, { effectiveTo: { $gte: workDate } }],
    daysOfWeek: weekday,
  }).sort({ effectiveFrom: -1 }).lean();
  const assigned = assignment ? await WorkShiftModel.findOne({ _id: assignment.shiftId, companyCode, isActive: true }).lean() : null;
  const shift = assigned || await WorkShiftModel.findOne({ companyCode, isDefault: true, isActive: true }).lean();
  if (shift) return { shift, source: assigned ? "employee" as const : "company" as const, assignmentId: assignment?._id };

  const [company, user] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("locationConfig").lean(),
    UserModel.findById(employeeId).select("workHoursConfig").lean(),
  ]);
  const custom = user?.workHoursConfig?.useCustom ? user.workHoursConfig : undefined;
  const config: { checkInLimit?: string; checkOutLimit?: string; lunchBreakStart?: string; lunchBreakEnd?: string; workingDays?: number[] } = custom || company?.locationConfig || {};
  const startTime = config.checkInLimit || "08:30";
  const endTime = config.checkOutLimit || "17:30";
  const breakPeriods = config.lunchBreakStart && config.lunchBreakEnd
    ? [{ name: "Nghỉ trưa", startTime: config.lunchBreakStart, endTime: config.lunchBreakEnd, paid: false }]
    : [];
  return { shift: { _id: undefined, code: "LEGACY", name: "Giờ làm việc hiện tại", startTime, endTime,
    crossesMidnight: minutesOf(endTime) <= minutesOf(startTime), breakPeriods,
    allowedLateMinutes: 0, allowedEarlyLeaveMinutes: 0,
    standardMinutes: calculateStandardMinutes(startTime, endTime, breakPeriods),
    workingDays: config.workingDays?.length ? config.workingDays : [1, 2, 3, 4, 5], isDefault: true, isActive: true },
    source: "legacy" as const };
}

export function shiftWindow(shift: any, workDate: string) {
  const scheduledStartAt = scheduledAt(workDate, shift.startTime);
  const scheduledEndAt = scheduledAt(workDate, shift.endTime, shift.crossesMidnight || minutesOf(shift.endTime) <= minutesOf(shift.startTime));
  return { scheduledStartAt, scheduledEndAt };
}
