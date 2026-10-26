import { Types } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import type { ICashierShift } from "../interfaces/cashier-shift.interface";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { RetailOrderModel } from "../models/retail-order.model";
import { resolveShift, scheduledAt, shiftWindow, vietnamWorkDate, weekdayOf } from "../../../service/work-shift.service";
import { ConflictError, ValidationError } from "../../../errors/app-error";
import { UserModel } from "../../../model/user.model";
import { hasEffectiveRetailCapability } from "../permissions";

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
  if (!shift) throw new ConflictError("SHIFT_NOT_OPEN", "Bạn chưa mở ca bán hàng.");
  if (!isRetailShiftOperational(shift, now)) throw new ConflictError("SHIFT_EXPIRED", "Ca bán hàng đã hết thời gian hoạt động. Vui lòng đóng ca cũ.");
  return shift;
}
const clock = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
export const formatShiftClock = (value: Date) => clock.format(value);

export type ShiftScheduleRejection = {
  reason: "non_working_day" | "before_shift" | "after_shift";
  workDate: string;
  workShiftCode: string;
  workShiftName: string;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
};

// Người dùng chỉ sửa được lỗi này khi biết ca nào đang áp dụng và khung giờ ra sao,
// nên ngữ cảnh đi kèm trong details để giao diện dựng thông báo tại chỗ.
export function shiftScheduleRejectionMessage(details: ShiftScheduleRejection) {
  const shiftLabel = `ca ${details.workShiftName}`;
  if (details.reason === "non_working_day") {
    return `Hôm nay không nằm trong lịch làm việc của ${shiftLabel}. Bạn chỉ mở được ca bán hàng vào ngày làm việc được phân công.`;
  }
  const window = `${formatShiftClock(details.scheduledStartAt!)}–${formatShiftClock(details.scheduledEndAt!)}`;
  return details.reason === "before_shift"
    ? `Chưa đến giờ làm việc của ${shiftLabel} (${window}). Bạn có thể mở ca bán hàng từ ${formatShiftClock(details.scheduledStartAt!)}.`
    : `Đã hết giờ làm việc của ${shiftLabel} (${window}). Bạn không thể mở ca bán hàng ngoài khung giờ được phân công.`;
}

export const outsideWorkScheduleError = (details?: ShiftScheduleRejection) => new ConflictError(
  "SHIFT_OUTSIDE_WORK_SCHEDULE",
  details ? shiftScheduleRejectionMessage(details) : "Chỉ được mở ca bán hàng trong giờ làm việc được phân công.",
  details ? { ...details } : undefined,
);

export function buildRetailShiftScheduleSnapshot(resolved: Awaited<ReturnType<typeof resolveShift>>, workDate: string, now: Date) {
  const shift = resolved.shift as any;
  const identity = { workDate, workShiftCode: String(shift.code), workShiftName: String(shift.name) };
  if (!(shift.workingDays || []).includes(weekdayOf(workDate))) {
    throw outsideWorkScheduleError({ reason: "non_working_day", ...identity });
  }
  const { scheduledStartAt, scheduledEndAt } = shiftWindow(shift, workDate);
  if (now < scheduledStartAt || now > scheduledEndAt) {
    throw outsideWorkScheduleError({
      reason: now < scheduledStartAt ? "before_shift" : "after_shift",
      ...identity, scheduledStartAt, scheduledEndAt,
    });
  }
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
  // Ca xuyên đêm mở sau nửa đêm vẫn thuộc ngày làm việc hôm trước, nên thử cả hai ngày.
  // Lỗi của hôm nay mới là lỗi người dùng cần đọc, vì vậy giữ lại để ném ra cuối cùng.
  let rejection: unknown;
  for (const businessDate of [today, previous.toISOString().slice(0, 10)]) {
    try {
      return { businessDate, snapshot: buildRetailShiftScheduleSnapshot(await resolver(companyCode, employeeId, businessDate), businessDate, now) };
    } catch (error: any) {
      if (error?.code !== "SHIFT_OUTSIDE_WORK_SCHEDULE") throw error;
      rejection ??= error;
    }
  }
  throw rejection ?? outsideWorkScheduleError();
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
    const shift = assertRetailShiftOperational(await CashierShiftModel.findOne({ ...scope, cashierId: actorId(actor), status: "open" }), now);
    if (shift.pausedAt) throw new ConflictError("SHIFT_PAUSED", "Ca bán hàng đang tạm dừng. Vui lòng mở lại ca trước khi bán.");
    return shift;
  },
  async list(scope: RetailBranchScope, query: any) {
    const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); const filter: any = { ...scope };
    for (const key of ["businessDate", "cashierId", "status"]) if (query[key]) filter[key] = query[key];
    const [items, total] = await Promise.all([CashierShiftModel.find(filter).sort({ openedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CashierShiftModel.countDocuments(filter)]); return { items, total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã ca không hợp lệ."); const shift = await CashierShiftModel.findOne({ _id: id, ...scope }).lean(); if (!shift) throw new Error("Không tìm thấy ca bán hàng."); const orders = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).sort({ createdAt: -1 }).lean(); return { shift, orders };
  },
  async open(scope: RetailBranchScope, input: any, actor: any, cashier: any = actor) {
    const openingFloat = parseOpeningFloat(input.openingFloat);
    const now = new Date(); const terminalId = String(input.terminalId || "").trim() || undefined;
    if (terminalId && terminalId.length > 60) throw new ValidationError("SHIFT_TERMINAL_INVALID", "Mã quầy không quá 60 ký tự.");
    const { businessDate, snapshot } = await resolveRetailShiftSchedule(scope.companyCode, actorId(cashier), now);
    return CashierShiftModel.create({ ...scope, terminalId, shiftCode: `CA-${scope.branchId}-${now.getTime()}`, cashierId: actorId(cashier), cashierName: actorName(cashier), openingFloat, openedAt: now, openedBy: actorId(actor), grossSales: 0, collectedAmount: 0, newDebtAmount: 0, refundedAmount: 0, netCollectedAmount: 0, methodTotals: [], expectedCash: openingFloat, status: "open", businessDate, ...snapshot });
  },
  async assignableCashiers(scope: RetailBranchScope) {
    return UserModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, isActive: { $ne: false } })
      .select("displayName email role permissions").sort({ displayName: 1 }).limit(200).lean();
  },
  async openFor(scope: RetailBranchScope, input: any, actor: any) {
    const cashierId = String(input.cashierId || "");
    if (!Types.ObjectId.isValid(cashierId)) throw new ValidationError("SHIFT_CASHIER_INVALID", "Vui lòng chọn thu ngân hợp lệ.");
    const cashier = await UserModel.findOne({ _id: cashierId, companyCode: scope.companyCode, branchId: scope.branchId, isActive: { $ne: false } })
      .select("displayName email role permissions companyCode").lean();
    if (!cashier || !await hasEffectiveRetailCapability({ ...cashier, id: String(cashier._id) }, "operate")) {
      throw new ValidationError("SHIFT_CASHIER_INVALID", "Thu ngân không thuộc chi nhánh hoặc chưa có quyền bán lẻ.");
    }
    return this.open(scope, input, actor, { id: String(cashier._id), displayName: cashier.displayName, email: cashier.email });
  },
  async pause(scope: RetailBranchScope, id: string, input: any, actor: any) {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("SHIFT_ID_INVALID", "Mã ca bán hàng không hợp lệ.");
    const reason = String(input.reason || "").trim();
    if (!reason || reason.length > 500) throw new ValidationError("SHIFT_PAUSE_REASON_INVALID", "Vui lòng nhập lý do tạm dừng không quá 500 ký tự.");
    const shift = await CashierShiftModel.findOneAndUpdate(
      { _id: id, ...scope, cashierId: actorId(actor), status: "open", pausedAt: { $exists: false } },
      { $set: { pausedAt: new Date(), pausedBy: actorId(actor), pauseReason: reason } },
      { returnDocument: "after" },
    );
    if (!shift) throw new ConflictError("SHIFT_NOT_ACTIVE", "Ca đã tạm dừng, đóng hoặc không thuộc thu ngân.");
    return shift;
  },
  async resume(scope: RetailBranchScope, id: string, input: any, actor: any) {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("SHIFT_ID_INVALID", "Mã ca bán hàng không hợp lệ.");
    const current = await CashierShiftModel.findOne({ _id: id, ...scope, cashierId: actorId(actor), status: "open", pausedAt: { $exists: true } });
    if (!current) throw new ConflictError("SHIFT_NOT_PAUSED", "Ca chưa tạm dừng, đã đóng hoặc không thuộc thu ngân.");
    assertRetailShiftOperational(current);
    const terminalId = String(input.terminalId ?? current.terminalId ?? "").trim();
    if (terminalId.length > 60) throw new ValidationError("SHIFT_TERMINAL_INVALID", "Mã quầy không quá 60 ký tự.");
    const changed = terminalId !== String(current.terminalId || "");
    const shift = await CashierShiftModel.findOneAndUpdate(
      { _id: id, ...scope, cashierId: actorId(actor), status: "open", pausedAt: current.pausedAt },
      { $set: { terminalId: terminalId || undefined }, $unset: { pausedAt: 1, pausedBy: 1, pauseReason: 1 }, ...(changed ? { $push: { terminalHistory: { fromTerminalId: current.terminalId, toTerminalId: terminalId, changedAt: new Date(), changedBy: actorId(actor) } } } : {}) },
      { returnDocument: "after" },
    );
    if (!shift) throw new ConflictError("SHIFT_CHANGED", "Ca đã thay đổi trên thiết bị khác.");
    return shift;
  },
  async recordMovement(scope: RetailBranchScope, id: string, input: any, actor: any) {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("SHIFT_ID_INVALID", "Mã ca bán hàng không hợp lệ.");
    const type = String(input.type || "");
    const amount = Number(input.amount);
    const reason = String(input.reason || "").trim();
    const idempotencyKey = String(input.idempotencyKey || "").trim();
    if (type !== "in" && type !== "out") throw new ValidationError("SHIFT_MOVEMENT_TYPE_INVALID", "Chọn loại thu hoặc rút quỹ.");
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError("SHIFT_MOVEMENT_AMOUNT_INVALID", "Số tiền thu/rút quỹ phải là số nguyên dương.");
    if (!reason || reason.length > 500) throw new ValidationError("SHIFT_MOVEMENT_REASON_INVALID", "Vui lòng nhập lý do thu/rút quỹ không quá 500 ký tự.");
    if (!idempotencyKey || idempotencyKey.length > 120) throw new ValidationError("SHIFT_MOVEMENT_KEY_INVALID", "Thiếu khóa chống ghi trùng thu/rút quỹ.");
    const shift = await CashierShiftModel.findOneAndUpdate(
      { _id: id, ...scope, cashierId: actorId(actor), status: "open", pausedAt: { $exists: false }, "cashMovements.idempotencyKey": { $ne: idempotencyKey } },
      { $push: { cashMovements: { type, amount, reason, idempotencyKey, at: new Date(), by: actorId(actor), byName: actorName(actor) } } },
      { returnDocument: "after" },
    );
    if (!shift) {
      const prior = await CashierShiftModel.findOne({ _id: id, ...scope, cashierId: actorId(actor), "cashMovements.idempotencyKey": idempotencyKey });
      const movement = (prior?.cashMovements as any[] | undefined)?.find((item) => item.idempotencyKey === idempotencyKey);
      if (movement) {
        if (movement.type !== type || movement.amount !== amount || movement.reason !== reason) throw new ConflictError("SHIFT_MOVEMENT_KEY_REUSED", "Khóa yêu cầu đã được dùng cho khoản thu/rút khác.");
        return prior;
      }
      throw new ConflictError("SHIFT_NOT_OPEN", "Ca bán hàng không còn mở hoặc không thuộc thu ngân.");
    }
    return shift;
  },
  async reconcile(scope: RetailBranchScope, id: string, actor: any) {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("SHIFT_ID_INVALID", "Mã ca bán hàng không hợp lệ.");
    const shift = await CashierShiftModel.findOneAndUpdate(
      { _id: id, ...scope, status: "closed", countedCash: { $exists: true }, varianceAmount: { $exists: true } },
      { $set: { status: "reconciled", approvedBy: actorId(actor), approvedByName: actorName(actor), approvedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!shift) throw new ConflictError("SHIFT_NOT_CLOSED", "Ca chưa đóng hoặc đã được đối soát.");
    return shift;
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
