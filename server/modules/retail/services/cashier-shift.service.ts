import { Types } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import type { ICashierShift } from "../interfaces/cashier-shift.interface";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { RetailOrderModel } from "../models/retail-order.model";
import { resolveShift, scheduledAt, shiftWindow, vietnamWorkDate, weekdayOf } from "../../../service/work-shift.service";
import { ValidationError } from "../../../errors/app-error";

type CashInputs = { openingFloat: number; cashCollected: number; cashRefunded: number; movementsIn: number; movementsOut: number };
export function calculateExpectedCash(input: CashInputs) { return input.openingFloat + input.cashCollected + input.movementsIn - input.movementsOut - input.cashRefunded; }
export function varianceNeedsReason(variance: number, threshold: number) { return Math.abs(variance) > threshold; }
export const invalidOpeningFloatError = () => new ValidationError(
  "SHIFT_OPENING_FLOAT_INVALID",
  "Quỹ đầu ca phải là số nguyên không âm.",
);
export function parseOpeningFloat(value: unknown) {
  const openingFloat = Number(value);
  if (!Number.isSafeInteger(openingFloat) || openingFloat < 0) throw invalidOpeningFloatError();
  return openingFloat;
}
export const missingVarianceReasonError = () => new ValidationError(
  "SHIFT_VARIANCE_REASON_REQUIRED",
  "Vui lòng nhập lý do chênh lệch ca.",
);
export function retailShiftOperationalEndsAt(input: { businessDate: string; scheduledEndAt: Date; crossesMidnight: boolean }) {
  if (input.crossesMidnight) return input.scheduledEndAt;
  return new Date(scheduledAt(input.businessDate, "00:00", true).getTime() - 1);
}
export function isRetailShiftOperational(shift: { businessDate?: string; operationalEndsAt?: Date | string }, now = new Date()) {
  const deadline = shift.operationalEndsAt
    ? new Date(shift.operationalEndsAt)
    : shift.businessDate
      ? new Date(scheduledAt(shift.businessDate, "00:00", true).getTime() - 1)
      : new Date(0);
  return now.getTime() <= deadline.getTime();
}
export function assertRetailShiftOperational<T extends { businessDate?: string; operationalEndsAt?: Date | string }>(shift: T | null | undefined, now = new Date()): T {
  if (!shift) throw Object.assign(new Error("Bạn chưa mở ca bán hàng."), { status: 409, code: "SHIFT_NOT_OPEN" });
  if (!isRetailShiftOperational(shift, now)) throw Object.assign(new Error("Ca bán hàng đã hết thời gian hoạt động. Vui lòng đóng ca cũ."), { status: 409, code: "SHIFT_EXPIRED" });
  return shift;
}
const outsideWorkSchedule = () => Object.assign(new Error("Chỉ được mở ca bán hàng trong giờ làm việc được phân công."), { status: 409, code: "OUTSIDE_WORK_SCHEDULE" });
export function buildRetailShiftScheduleSnapshot(resolved: Awaited<ReturnType<typeof resolveShift>>, workDate: string, now: Date) {
  const shift = resolved.shift as any;
  if (!(shift.workingDays || []).includes(weekdayOf(workDate))) throw outsideWorkSchedule();
  const { scheduledStartAt, scheduledEndAt } = shiftWindow(shift, workDate);
  if (now < scheduledStartAt || now > scheduledEndAt) throw outsideWorkSchedule();
  return {
    ...(shift._id ? { workShiftId: String(shift._id) } : {}),
    workShiftCode: String(shift.code), workShiftName: String(shift.name), scheduledStartAt, scheduledEndAt,
    operationalEndsAt: retailShiftOperationalEndsAt({ businessDate: workDate, scheduledEndAt, crossesMidnight: Boolean(shift.crossesMidnight) }),
  };
}
export async function resolveRetailShiftSchedule(
  companyCode: string,
  employeeId: string,
  now = new Date(),
  resolver: typeof resolveShift = resolveShift,
) {
  const today = vietnamWorkDate(now);
  const previous = new Date(`${today}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  for (const businessDate of [today, previous.toISOString().slice(0, 10)]) {
    try {
      return { businessDate, snapshot: buildRetailShiftScheduleSnapshot(await resolver(companyCode, employeeId, businessDate), businessDate, now) };
    } catch (error: any) {
      if (error?.code !== "OUTSIDE_WORK_SCHEDULE") throw error;
    }
  }
  throw outsideWorkSchedule();
}
export function serializeCashierShift(shift: ICashierShift | Record<string, any>, canManage: boolean) {
  const value = typeof (shift as any).toObject === "function" ? (shift as any).toObject() : { ...shift };
  if (value.status !== "open" || value.countedCash != null || canManage) return value;
  const { expectedCash: _expectedCash, grossSales: _grossSales, collectedAmount: _collectedAmount, newDebtAmount: _newDebtAmount, refundedAmount: _refundedAmount, netCollectedAmount: _netCollectedAmount, ...safe } = value;
  return { ...safe, methodTotals: (value.methodTotals || []).map((item: any) => ({ method: item.method })) };
}
export function businessDateInVietnam(at: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(at); }
const actorId = (actor: any) => String(actor.id || actor.uid || "");
const actorName = (actor: any) => String(actor.displayName || actor.email || "");

export const CashierShiftService = {
  current: (scope: RetailBranchScope, actor: any) => CashierShiftModel.findOne({ ...scope, cashierId: actorId(actor), status: "open" }),
  async operational(scope: RetailBranchScope, actor: any, now = new Date()) {
    return assertRetailShiftOperational(await CashierShiftModel.findOne({ ...scope, cashierId: actorId(actor), status: "open" }), now);
  },
  async list(scope: RetailBranchScope, query: any) {
    const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); const filter: any = { ...scope };
    for (const key of ["businessDate", "cashierId", "status"]) if (query[key]) filter[key] = query[key];
    const [items, total] = await Promise.all([CashierShiftModel.find(filter).sort({ openedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CashierShiftModel.countDocuments(filter)]); return { items, total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã ca không hợp lệ."); const shift = await CashierShiftModel.findOne({ _id: id, ...scope }).lean(); if (!shift) throw new Error("Không tìm thấy ca bán hàng."); const orders = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).sort({ createdAt: -1 }).lean(); return { shift, orders };
  },
  async open(scope: RetailBranchScope, input: any, actor: any) {
    const openingFloat = parseOpeningFloat(input.openingFloat);
    const now = new Date(); const terminalId = String(input.terminalId || "").trim() || undefined;
    const { businessDate, snapshot } = await resolveRetailShiftSchedule(scope.companyCode, actorId(actor), now);
    return CashierShiftModel.create({ ...scope, terminalId, shiftCode: `CA-${scope.branchId}-${now.getTime()}`, cashierId: actorId(actor), cashierName: actorName(actor), openingFloat, openedAt: now, openedBy: actorId(actor), grossSales: 0, collectedAmount: 0, newDebtAmount: 0, refundedAmount: 0, netCollectedAmount: 0, methodTotals: [], expectedCash: openingFloat, status: "open", businessDate, ...snapshot });
  },
  async close(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const countedCash = Number(input.countedCash); if (!Number.isSafeInteger(countedCash) || countedCash < 0) throw new Error("Tiền thực đếm không hợp lệ.");
    const shift = await CashierShiftModel.findOne({ _id: id, ...scope, cashierId: actorId(actor), status: "open" }); if (!shift) throw new Error("Ca bán hàng không còn mở.");
    const orders: any[] = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).lean();
    const sold = orders.filter((order) => order.shiftId === id && order.status !== "cancelled");
    shift.grossSales = sold.reduce((sum, order) => sum + order.grandTotal, 0);
    shift.newDebtAmount = sold.reduce((sum, order) => sum + order.dueAmount, 0);
    const methodMap = new Map<string, { method: any; collectedAmount: number; refundedAmount: number }>();
    for (const order of orders) {
      for (const payment of order.payments || []) if (payment.shiftId === id) { const row = methodMap.get(payment.method) || { method: payment.method, collectedAmount: 0, refundedAmount: 0 }; row.collectedAmount += payment.amount; methodMap.set(payment.method, row); }
      for (const refund of order.refunds || []) if (refund.shiftId === id) { const row = methodMap.get(refund.method) || { method: refund.method, collectedAmount: 0, refundedAmount: 0 }; row.refundedAmount += refund.amount; methodMap.set(refund.method, row); }
    }
    shift.methodTotals = [...methodMap.values()]; shift.collectedAmount = shift.methodTotals.reduce((sum, row) => sum + row.collectedAmount, 0); shift.refundedAmount = shift.methodTotals.reduce((sum, row) => sum + row.refundedAmount, 0); shift.netCollectedAmount = shift.collectedAmount - shift.refundedAmount;
    const legacyMovements = shift.cashMovements || [];
    const movementsIn = legacyMovements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.amount, 0); const movementsOut = legacyMovements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.amount, 0);
    const cash = shift.methodTotals.find((item) => item.method === "cash"); shift.expectedCash = calculateExpectedCash({ openingFloat: shift.openingFloat, cashCollected: cash?.collectedAmount || 0, cashRefunded: cash?.refundedAmount || 0, movementsIn, movementsOut }); shift.countedCash = countedCash; shift.varianceAmount = countedCash - shift.expectedCash;
    const settings = await getResolvedRetailSettings(scope); const reason = String(input.varianceReason || "").trim(); if (varianceNeedsReason(shift.varianceAmount, settings.varianceReasonThreshold) && !reason) throw missingVarianceReasonError();
    shift.varianceReason = reason || undefined; shift.status = "closed"; shift.closedAt = new Date(); shift.closedBy = actorId(actor); await shift.save(); return shift;
  },
};
