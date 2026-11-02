import mongoose, { Types } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import type { ICashierShift } from "../interfaces/cashier-shift.interface";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { resolveShift, scheduledAt, shiftWindow, vietnamWorkDate, weekdayOf } from "../../../service/work-shift.service";
import { ConflictError, ValidationError } from "../../../errors/app-error";
import { emitToUser } from "../../../socket";
import { UserModel } from "../../../model/user.model";
import { hasEffectiveRetailCapability } from "../permissions";
import { RetailPosDrawerModel } from "../models/retail-pos-drawer.model";
import { RetailPosSessionSnapshotModel } from "../models/retail-pos-session-snapshot.model";

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
    workShiftCode: String(shift.code), workShiftName: String(shift.name), workShiftSource: resolved.source, workShiftBusinessDate: workDate, scheduledStartAt, scheduledEndAt,
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
  if (!canManage) delete value.closingSnapshot;
  if (value.status !== "open" || value.countedCash != null || canManage) return value;
  const { expectedCash: _expectedCash, grossSales: _grossSales, collectedAmount: _collectedAmount, newDebtAmount: _newDebtAmount, customerDebtAmount: _customerDebtAmount, financingDebtAmount: _financingDebtAmount, refundedAmount: _refundedAmount, netCollectedAmount: _netCollectedAmount, closingSnapshot: _snapshot, ...safe } = value;
  return { ...safe, methodTotals: (value.methodTotals || []).map((item: any) => ({ method: item.method })) };
}
export function businessDateInVietnam(at: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(at); }
export function nextVietnameseMidnight(businessDate: string) {
  const [year, month, day] = businessDate.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
  return new Date(`${nextDate}T00:00:00+07:00`);
}
export function posSessionOperationalEndsAt(businessDate: string) { return new Date(nextVietnameseMidnight(businessDate).getTime() - 1); }
const actorId = (actor: any) => String(actor.id || actor.uid || "");
const actorName = (actor: any) => String(actor.displayName || actor.email || "");

export function summarizeShift(shift: any, orders: any[]) {
  const id = String(shift._id);
  const sold = orders.filter((order) => order.shiftId === id && order.status !== "cancelled" && order.status !== "draft");
  const methodMap = new Map<string, { method: any; collectedAmount: number; refundedAmount: number }>();
  for (const order of orders) {
    for (const payment of order.payments || []) if (payment.shiftId === id) {
      const row = methodMap.get(payment.method) || { method: payment.method, collectedAmount: 0, refundedAmount: 0 };
      row.collectedAmount += payment.amount;
      methodMap.set(payment.method, row);
    }
    for (const refund of order.refunds || []) if (refund.shiftId === id) {
      const row = methodMap.get(refund.method) || { method: refund.method, collectedAmount: 0, refundedAmount: 0 };
      row.refundedAmount += refund.amount;
      methodMap.set(refund.method, row);
    }
  }
  const methodTotals = [...methodMap.values()];
  const collectedAmount = methodTotals.reduce((sum, row) => sum + row.collectedAmount, 0);
  const refundedAmount = methodTotals.reduce((sum, row) => sum + row.refundedAmount, 0);
  const legacyMovements = shift.cashMovements || [];
  const movementsIn = legacyMovements.filter((movement: any) => movement.type === "in").reduce((sum: number, movement: any) => sum + movement.amount, 0);
  const movementsOut = legacyMovements.filter((movement: any) => movement.type === "out").reduce((sum: number, movement: any) => sum + movement.amount, 0);
  const cash = methodTotals.find((item) => item.method === "cash");
  const debtBalance = (order: any) => Math.max(0, Number(order.dueAmount || 0) - Number(order.pendingTransferAmount || 0));
  return {
    grossSales: sold.reduce((sum, order) => sum + order.grandTotal, 0),
    newDebtAmount: sold.reduce((sum, order) => sum + debtBalance(order), 0),
    customerDebtAmount: sold.filter((order) => !order.installment).reduce((sum, order) => sum + debtBalance(order), 0),
    financingDebtAmount: sold.filter((order) => order.installment).reduce((sum, order) => sum + debtBalance(order), 0),
    methodTotals,
    collectedAmount,
    refundedAmount,
    netCollectedAmount: collectedAmount - refundedAmount,
    expectedCash: calculateExpectedCash({ openingFloat: shift.openingFloat, cashCollected: cash?.collectedAmount || 0, cashRefunded: cash?.refundedAmount || 0, movementsIn, movementsOut }),
  };
}

// The midnight worker may run later than 00:00. Rebuild that boundary from
// transaction timestamps rather than using the order's current balance/status.
function ordersAtCutoff(orders: any[], at: Date) {
  const cutoff = at.getTime();
  return orders.map((source) => {
    const allPayments = source.payments || [];
    const payments = allPayments.filter((payment: any) => new Date(payment.recordedAt || payment.paidAt).getTime() < cutoff);
    const pendingTransferAmount = Number(source.pendingTransferAmount || 0) + allPayments.reduce((sum: number, payment: any) =>
      new Date(payment.recordedAt || payment.paidAt).getTime() >= cutoff ? sum + Number(payment.pendingTransferAppliedAmount || 0) : sum, 0);
    const refunds = (source.refunds || []).filter((refund: any) => new Date(refund.refundedAt).getTime() < cutoff);
    const paidAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const refundedAmount = refunds.reduce((sum: number, refund: any) => sum + refund.amount, 0);
    const cancelled = source.status === "cancelled" && source.cancelledAt && new Date(source.cancelledAt).getTime() < cutoff;
    const status = cancelled ? "cancelled" : source.status === "draft" ? "draft" : paidAmount >= source.grandTotal ? "completed" : "confirmed";
    return { ...source, payments, refunds, paidAmount, refundedAmount, dueAmount: Math.max(0, source.grandTotal - paidAmount), pendingTransferAmount, status,
      paymentStatus: refundedAmount >= source.grandTotal && refundedAmount > 0 ? "refunded" : paidAmount >= source.grandTotal ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
      ...(!cancelled ? { cancelledAt: undefined, cancelReason: undefined, cancelledByName: undefined } : {}),
    };
  }).filter((order) => !order.confirmedAt || new Date(order.confirmedAt).getTime() < cutoff);
}

export function emitSessionChange(event: string, shift: any) {
  const payload = {
    companyCode: shift.companyCode,
    sessionId: String(shift._id),
    branchId: shift.branchId,
    terminalId: shift.terminalId || "default",
    cashierId: shift.cashierId,
    status: shift.status,
    closingMode: shift.closingMode,
    changedAt: new Date().toISOString(),
  };
  emitToUser(shift.cashierId, event, payload);
  // Resolve permissions on the server; POS details must not be broadcast to the company room.
  void UserModel.find({ isActive: { $ne: false }, $or: [{ companyCode: shift.companyCode, branchId: shift.branchId }, { role: "superadmin" }] })
    .select("_id role permissions companyCode").lean().then(async (users) => {
      for (const user of users) {
        if (String(user._id) !== shift.cashierId && await hasEffectiveRetailCapability({ ...user, id: String(user._id) }, "manager")) {
          emitToUser(String(user._id), event, payload);
        }
      }
    }).catch((error) => console.error("[POS session notification]", error));
}

function audit(actor: any, action: string, detail?: string) {
  return { action, detail, at: new Date(), by: actorId(actor), byName: actorName(actor) };
}
const movementPayload = (input: any) => JSON.stringify([input.type, Number(input.amount), String(input.reason || "").trim(), String(input.reversesKey || "")]);

export async function capturePosSession(shift: any, orders: any[], session: mongoose.ClientSession, at: Date) {
  const id = String(shift._id);
  const recordedOrders = orders.filter((order) => order.status !== "draft");
  if (recordedOrders.length) await RetailPosSessionSnapshotModel.insertMany(recordedOrders.map((order) => ({
    companyCode: shift.companyCode, branchId: shift.branchId, shiftId: id, orderId: String(order._id), order,
  })), { session });
  const sold = recordedOrders.filter((order) => String(order.shiftId) === id && order.status !== "cancelled");
  const products = new Map<string, any>();
  for (const order of sold) for (const item of order.items || []) {
    const key = `${item.productId}:${item.variantId || item.sku}`;
    const row = products.get(key) || { sku: item.sku, name: item.productName, quantity: 0, sales: 0 };
    row.quantity += item.quantity; row.sales += item.lineTotal; products.set(key, row);
  }
  shift.closingSnapshot = { capturedAt: at, orderCount: recordedOrders.length, soldOrderCount: sold.length, products: [...products.values()] };
}

async function closeAtMidnight(id: string, now: Date) {
  const session = await mongoose.startSession();
  let closed: any = null;
  try {
    await session.withTransaction(async () => {
      closed = null;
      const shift: any = await CashierShiftModel.findOne({ _id: id, status: "open" }).session(session);
      if (!shift) return;
      const deadline = shift.operationalEndsAt || (shift.businessDate ? posSessionOperationalEndsAt(shift.businessDate) : new Date(0));
      if (deadline.getTime() > now.getTime()) return;
      const cutoff = new Date(deadline.getTime() + 1);
      const orders = ordersAtCutoff(await RetailOrderModel.find({ companyCode: shift.companyCode, branchId: shift.branchId, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).session(session).lean(), cutoff);
      const boundaryShift = { ...shift.toObject(), cashMovements: shift.cashMovements.filter((movement: any) => new Date(movement.at).getTime() < cutoff.getTime()) };
      await capturePosSession(shift, orders, session, cutoff);
      Object.assign(shift, summarizeShift(boundaryShift, orders), {
        status: "closed",
        closingMode: "midnight",
        closedAt: cutoff,
        closedBy: "system:pos-midnight",
        countedCash: undefined,
        varianceAmount: undefined,
        varianceReason: undefined,
      });
      shift.auditLog.push(audit({ id: "system:pos-midnight", displayName: "Hệ thống" }, "midnight-close"));
      await shift.save({ session });
      closed = shift.toObject();
    });
  } finally {
    await session.endSession();
  }
  if (closed) emitSessionChange("pos:session:closed", closed);
  return closed;
}

export async function closeExpiredRetailPosSessions(now = new Date()) {
  const today = businessDateInVietnam(now);
  const candidates = await CashierShiftModel.find({ status: "open", $or: [
    { operationalEndsAt: { $lt: now } },
    { operationalEndsAt: { $exists: false }, businessDate: { $lte: today } },
  ] }).select("_id").lean();
  const closed: any[] = [];
  for (const candidate of candidates) {
    try {
      const result = await closeAtMidnight(String(candidate._id), now);
      if (result) closed.push(result);
    } catch (error) {
      console.error("[POS session midnight close]", String(candidate._id), error);
    }
  }
  return closed;
}

export const CashierShiftService = {
  async cashiers(scope: RetailBranchScope) {
    const users = await UserModel.find({ ...scope, isActive: { $ne: false }, accountType: { $ne: "partner" } }).select("_id displayName email role permissions companyCode").sort({ displayName: 1 }).lean();
    const result: Array<{ id: string; name: string }> = [];
    for (const user of users) if (await hasEffectiveRetailCapability({ ...user, id: String(user._id) }, "operate")) result.push({ id: String(user._id), name: user.displayName || user.email });
    return result;
  },
  async drawers(scope: RetailBranchScope) { return RetailPosDrawerModel.find({ ...scope, isActive: true }).sort({ code: 1 }).lean(); },
  async createDrawer(scope: RetailBranchScope, input: any) {
    const code = String(input.code || "").trim().toUpperCase(), name = String(input.name || "").trim();
    if (!code || code.length > 50 || !name || name.length > 100) throw new ValidationError("DRAWER_INVALID", "Nhập mã và tên quầy/két hợp lệ.");
    return RetailPosDrawerModel.findOneAndUpdate({ ...scope, code }, { $setOnInsert: { ...scope, code, name, isActive: true } }, { upsert: true, returnDocument: "after" });
  },
  async resume(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const terminalId = String(input.terminalId || "").trim();
    if (!terminalId || terminalId.length > 150) throw new ValidationError("SHIFT_TERMINAL_INVALID", "Thiếu mã thiết bị POS.");
    const current: any = await this.current(scope, actor);
    if (!current || String(current._id) !== id) throw new ConflictError("SHIFT_NOT_OPEN", "Phiên POS không còn mở.");
    const expected = String(input.expectedTerminalId || "");
    if (String(current.terminalId || "") !== expected) throw new ConflictError("SHIFT_DEVICE_CHANGED", "Thiết bị đã thay đổi. Vui lòng tải lại trạng thái phiên.");
    if (current.terminalId === terminalId) return current;
    let shift;
    try {
      shift = await CashierShiftModel.findOneAndUpdate({ _id: id, ...scope, cashierId: actorId(actor), status: "open", terminalId: expected || { $in: [null, ""] }, operationalEndsAt: { $gte: new Date() } },
        { $set: { terminalId, lastActivityAt: new Date() }, $inc: { activityVersion: 1 }, $push: { auditLog: audit(actor, "resume", "Tiếp tục phiên trên thiết bị khác") } }, { returnDocument: "after" });
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictError("SHIFT_TERMINAL_BUSY", "Thiết bị đang được dùng cho một phiên khác. Đăng xuất tài khoản cũ trước khi tiếp tục.");
      throw error;
    }
    if (!shift) throw new ConflictError("SHIFT_DEVICE_CHANGED", "Phiên đã thay đổi. Vui lòng tải lại trạng thái.");
    emitSessionChange("pos:session:device-changed", shift); return shift;
  },
  async pause(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const shift = await CashierShiftModel.findOneAndUpdate({ _id: id, ...scope, cashierId: actorId(actor), status: "open", terminalId: String(input.terminalId || "") },
      { $unset: { terminalId: 1 }, $inc: { activityVersion: 1 }, $push: { auditLog: audit(actor, "pause", "Đăng xuất khỏi thiết bị") } }, { returnDocument: "after" });
    if (shift) emitSessionChange("pos:session:device-changed", shift); return shift;
  },
  async transferDrawer(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const reason = String(input.reason || "").trim();
    const drawer = Types.ObjectId.isValid(input.drawerId) ? await RetailPosDrawerModel.findOne({ _id: input.drawerId, ...scope, isActive: true }).lean() : null;
    if (!drawer || !reason) throw new ValidationError("SHIFT_DRAWER_INVALID", "Chọn két và nhập lý do chuyển.");
    let shift;
    try {
      shift = await CashierShiftModel.findOneAndUpdate({ _id: id, ...scope, status: "open", operationalEndsAt: { $gte: new Date() } },
        { $set: { drawerId: String(drawer._id), drawerName: drawer.name }, $inc: { activityVersion: 1 }, $push: { auditLog: audit(actor, "transfer-drawer", `${drawer.name}: ${reason}`) } }, { returnDocument: "after" });
    } catch (error: any) { if (error?.code === 11000) throw new ConflictError("SHIFT_DRAWER_BUSY", "Két đã được giao cho một phiên khác."); throw error; }
    if (!shift) throw new ConflictError("SHIFT_NOT_OPEN", "Phiên không còn mở.");
    emitSessionChange("pos:session:updated", shift); return shift;
  },
  async moveCash(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const amount = Number(input.amount), reason = String(input.reason || "").trim(), key = String(input.idempotencyKey || "").trim();
    if (!["in", "out"].includes(input.type) || !Number.isSafeInteger(amount) || amount <= 0 || !reason || reason.length > 500 || !key || key.length > 100) throw new ValidationError("SHIFT_MOVEMENT_INVALID", "Nhập loại, số tiền, lý do và mã giao dịch hợp lệ.");
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const shift: any = await CashierShiftModel.findOne({ _id: id, ...scope }).session(session);
        if (!shift) throw new ConflictError("SHIFT_NOT_OPEN", "Không tìm thấy phiên POS.");
        const prior = shift.cashMovements.find((movement: any) => (movement.key || movement.idempotencyKey) === key);
        if (prior) {
          if (prior.type !== input.type || prior.amount !== amount || prior.reason !== reason || String(prior.reversesKey || "") !== String(input.reversesKey || "")) throw new ConflictError("SHIFT_MOVEMENT_CONFLICT", "Mã giao dịch két đã được dùng với nội dung khác.");
          result = shift; return;
        }
        if (shift.voidedCashMovements.some((item: any) => item.key === key)) throw new ConflictError("SHIFT_MOVEMENT_REVOKED", "Yêu cầu thu/chi đã được thu hồi. Không thể ghi lại mã cũ.");
        if (shift.status !== "open") throw new ConflictError("SHIFT_NOT_OPEN", "Phiên POS đã đóng.");
        assertRetailShiftOperational(shift);
        if (input.reversesKey) {
          const source = shift.cashMovements.find((movement: any) => movement.key === input.reversesKey);
          if (!source || source.reversesKey || source.amount !== amount || source.type === input.type || shift.cashMovements.some((movement: any) => movement.reversesKey === input.reversesKey)) throw new ValidationError("SHIFT_MOVEMENT_INVALID", "Giao dịch gốc không hợp lệ hoặc đã được điều chỉnh.");
        }
        const orders = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).session(session).lean();
        const totals = summarizeShift(shift, orders);
        if (input.type === "out" && amount > totals.expectedCash) throw new ValidationError("SHIFT_CASH_INSUFFICIENT", "Số tiền rút vượt tiền mặt kỳ vọng trong két.");
        shift.cashMovements.push({ key, reversesKey: input.reversesKey || undefined, type: input.type, amount, reason, at: new Date(), by: actorId(actor), byName: actorName(actor) });
        shift.activityVersion = Number(shift.activityVersion || 0) + 1;
        shift.auditLog.push(audit(actor, "cash-movement", `${input.type === "in" ? "Bổ sung" : "Rút"} ${amount}: ${reason}`));
        await shift.save({ session });
        assertRetailShiftOperational(shift);
        result = shift;
      });
    } finally { await session.endSession(); }
    emitSessionChange("pos:session:updated", result); return result;
  },
  async reconcileMovement(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const key = String(input.idempotencyKey || "").trim();
    if (!key || key.length > 100) throw new ValidationError("SHIFT_MOVEMENT_INVALID", "Thiếu mã giao dịch két.");
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const shift: any = await CashierShiftModel.findOne({ _id: id, ...scope }).session(session);
        if (!shift) throw new ConflictError("SHIFT_NOT_OPEN", "Không tìm thấy phiên POS.");
        const prior = shift.cashMovements.find((movement: any) => (movement.key || movement.idempotencyKey) === key);
        if (prior) {
          if (movementPayload(prior) !== movementPayload(input)) throw new ConflictError("SHIFT_MOVEMENT_CONFLICT", "Giao dịch đã ghi không khớp yêu cầu đang lưu.");
          return { status: "completed", message: "Đã xác minh giao dịch thu/chi gốc." };
        }
        const voided = shift.voidedCashMovements.find((item: any) => item.key === key);
        if (voided) {
          if (voided.payload !== movementPayload(input)) throw new ConflictError("SHIFT_MOVEMENT_CONFLICT", "Mã thu hồi không khớp yêu cầu đang lưu.");
          return { status: "revoked", message: "Yêu cầu đã được thu hồi." };
        }
        if (!input.revoke) return { status: "not_found", message: "Chưa tìm thấy giao dịch. Giữ yêu cầu để thử lại hoặc thu hồi." };
        shift.voidedCashMovements.push({ key, payload: movementPayload(input), at: new Date(), by: actorId(actor) });
        shift.activityVersion = Number(shift.activityVersion || 0) + 1;
        shift.auditLog.push(audit(actor, "movement-revoke", key));
        await shift.save({ session });
        return { status: "revoked", message: "Đã thu hồi yêu cầu chưa ghi nhận; mã cũ không thể chi tiền lại." };
      });
    } finally { await session.endSession(); }
  },
  async settlements(scope: RetailBranchScope, query: any) {
    const page = Math.max(1, Number(query.page) || 1), limit = 20;
    const pipeline: any[] = [{ $match: { ...scope, "payments.settlementStatus": "unassigned" } }, { $unwind: { path: "$payments", includeArrayIndex: "paymentIndex" } }, { $match: { "payments.settlementStatus": "unassigned" } }, { $sort: { "payments.recordedAt": -1 } }];
    const [result] = await RetailOrderModel.aggregate([...pipeline, { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { _id: 1, orderCode: 1, shiftId: 1, paymentIndex: 1, payment: "$payments" } }], total: [{ $count: "count" }] } }]);
    return { items: result?.items || [], total: result?.total?.[0]?.count || 0, page, limit };
  },
  async reviewSettlement(scope: RetailBranchScope, input: any, actor: any) {
    const reason = String(input.reason || "").trim();
    const paymentIndex = input.paymentIndex;
    if (!Types.ObjectId.isValid(input.orderId) || !Number.isSafeInteger(paymentIndex) || paymentIndex < 0 || !reason || reason.length > 1000) throw new ValidationError("SETTLEMENT_INVALID", "Chọn khoản thu và nhập nội dung kiểm tra (tối đa 1000 ký tự).");
    const path = `payments.${paymentIndex}`;
    const order = await RetailOrderModel.findOneAndUpdate({ _id: input.orderId, ...scope, [`${path}.settlementStatus`]: "unassigned" },
      { $set: { [`${path}.settlementStatus`]: "reviewed", [`${path}.reviewedBy`]: actorId(actor), [`${path}.reviewedAt`]: new Date(), [`${path}.reviewReason`]: reason }, $inc: { version: 1 } }, { returnDocument: "after" });
    if (!order) throw new ConflictError("SETTLEMENT_ALREADY_REVIEWED", "Giao dịch đã được kiểm tra hoặc không tồn tại.");
    if (order.shiftId) emitSessionChange("pos:session:updated", { ...scope, _id: order.shiftId, cashierId: order.salespersonId });
    return { orderId: String(order._id), paymentIndex };
  },
  async current(scope: RetailBranchScope, actor: any, terminalId = "default") {
    const now = new Date();
    let shift: any = await CashierShiftModel.findOne({ ...scope, cashierId: actorId(actor), status: "open" });
    if (shift && !shift.operationalEndsAt) shift = await CashierShiftModel.findOneAndUpdate({ _id: shift._id, ...scope, status: "open" }, { $set: { operationalEndsAt: posSessionOperationalEndsAt(shift.businessDate) } }, { returnDocument: "after" });
    if (shift && !isRetailShiftOperational(shift, now)) {
      await closeAtMidnight(String(shift._id), now);
      return null;
    }
    return shift;
  },
  async operational(scope: RetailBranchScope, actor: any, now = new Date(), terminalId = "default", sessionId?: string) {
    const shift = sessionId
      ? await CashierShiftModel.findOne({ _id: sessionId, ...scope, cashierId: actorId(actor), terminalId, status: "open" })
      : await this.current(scope, actor, terminalId);
    const result = assertRetailShiftOperational(shift, now);
    if (result.terminalId !== terminalId) throw new ConflictError("SHIFT_DEVICE_CHANGED", "Phiên POS đang hoạt động trên thiết bị khác. Vui lòng tiếp tục phiên trên thiết bị này.");
    return result;
  },
  async list(scope: RetailBranchScope, query: any) {
    const page = Math.max(1, Number(query.page) || 1); const limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); const filter: any = { ...scope };
    if (query.from || query.to) filter.businessDate = {
      ...(query.from ? { $gte: String(query.from) } : {}),
      ...(query.to ? { $lte: String(query.to) } : {}),
    };
    if (query.cashierId) filter.cashierId = String(query.cashierId);
    if (query.status) filter.status = String(query.status);
    if (query.pendingReconciliation === "true") Object.assign(filter, { status: "closed" });
    const [items, total] = await Promise.all([CashierShiftModel.find(filter).sort({ openedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CashierShiftModel.countDocuments(filter)]);
    const openIds = items.filter((item) => item.status === "open").map((item) => String(item._id));
    const liveOrders = openIds.length ? await RetailOrderModel.find({ ...scope, $or: [{ shiftId: { $in: openIds } }, { "payments.shiftId": { $in: openIds } }, { "refunds.shiftId": { $in: openIds } }] }).lean() : [];
    for (const item of items) if (item.status === "open") {
      const id = String(item._id);
      Object.assign(item, summarizeShift(item, liveOrders), { soldOrderCount: liveOrders.filter((order) => order.shiftId === id && order.status !== "cancelled" && order.status !== "draft").length });
    }
    return { items, total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string, query: any = {}) {
    if (!Types.ObjectId.isValid(id)) throw new ValidationError("SHIFT_INVALID", "Mã phiên không hợp lệ.");
    const shift: any = await CashierShiftModel.findOne({ _id: id, ...scope }).lean();
    if (!shift) throw new ConflictError("SHIFT_NOT_FOUND", "Không tìm thấy phiên POS.");
    const page = Math.max(1, Number(query.page) || 1), limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const allLive: any[] = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).sort({ createdAt: -1 }).lean();
    const live = allLive.filter((order) => order.status !== "draft");
    let orders: any[], total: number;
    if (shift.closingSnapshot) {
      const snapshotFilter = { ...scope, shiftId: id, "order.status": { $ne: "draft" } };
      const [rows, snapshotTotal] = await Promise.all([
        RetailPosSessionSnapshotModel.find(snapshotFilter).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        RetailPosSessionSnapshotModel.countDocuments(snapshotFilter),
      ]);
      orders = rows.map((row) => row.order); total = snapshotTotal;
    } else {
      orders = live.slice((page - 1) * limit, page * limit); total = live.length;
      if (shift.status === "open") Object.assign(shift, summarizeShift(shift, live));
    }
    // After-sale receipts are immutable. Keep the close boundary when reading
    // them so subsequent receipts cannot change the closed session's history.
    const afterSalesPage = Math.max(1, Number(query.afterSalesPage) || 1);
    const receiptFilter = { ...scope, shiftId: id, ...(shift.closedAt ? { createdAt: { $lte: shift.closedAt } } : {}) };
    const [afterSales, afterSalesTotal, buybackMethodTotals] = await Promise.all([
      RetailAfterSaleModel.find(receiptFilter).sort({ createdAt: -1, _id: -1 }).skip((afterSalesPage - 1) * limit).limit(limit).lean(),
      RetailAfterSaleModel.countDocuments(receiptFilter),
      RetailAfterSaleModel.aggregate([
        { $match: { ...receiptFilter, type: "buyback" } },
        { $group: { _id: "$paymentMethod", amount: { $sum: "$totalAmount" } } },
        { $project: { _id: 0, method: "$_id", amount: 1 } },
      ]),
    ]);
    const sold = live.filter((order) => order.shiftId === id && order.status !== "cancelled");
    const snapshotOrders = shift.closingSnapshot
      ? await RetailPosSessionSnapshotModel.find({ ...scope, shiftId: id, "order.status": { $ne: "draft" } }).select("order").lean()
      : null;
    const profitOrders = snapshotOrders
      ? snapshotOrders.map((row: any) => row.order)
      : shift.closingSnapshot?.orderCount === 0
        ? []
        : live;
    let grossProfit: number | undefined;
    if (!shift.closingSnapshot || snapshotOrders !== null) {
      grossProfit = profitOrders
        .filter((order: any) => String(order.shiftId) === id && order.status !== "cancelled")
        .reduce((sum: number, order: any) => {
          const totalCost = Number(order.totalCost ?? (order.items || []).reduce((cost: number, item: any) => cost + Number(item.quantity || 0) * Number(item.unitCost || 0), 0));
          return sum + Number(order.grandTotal || 0) - Number(order.refundedAmount || 0) - totalCost;
        }, 0);
    }
    const products = new Map<string, any>();
    for (const order of sold) for (const item of order.items || []) {
      const key = `${item.productId}:${item.variantId || item.sku}`;
      const row = products.get(key) || { sku: item.sku, name: item.productName, quantity: 0, sales: 0 };
      row.quantity += item.quantity; row.sales += item.lineTotal; products.set(key, row);
    }
    return { shift, orders, total, page, limit, legacySnapshot: shift.status !== "open" && !shift.closingSnapshot, grossProfit,
      products: shift.closingSnapshot?.products || [...products.values()], soldOrderCount: shift.closingSnapshot?.soldOrderCount ?? sold.length,
      afterSales, afterSalesTotal, afterSalesPage, buybackMethodTotals };
  },
  async open(scope: RetailBranchScope, input: any, actor: any) {
    if (!await hasEffectiveRetailCapability(actor, "manager")) throw new ValidationError("SHIFT_MANAGER_REQUIRED", "Chỉ quản lý được mở phiên POS.");
    const openingFloat = parseOpeningFloat(input.openingFloat);
    await closeExpiredRetailPosSessions();
    const cashierId = String(input.cashierId || actorId(actor));
    if (!Types.ObjectId.isValid(cashierId)) throw new ValidationError("SHIFT_CASHIER_INVALID", "Mã nhân viên không hợp lệ.");
    const cashier: any = await UserModel.findOne({ _id: cashierId, companyCode: scope.companyCode, branchId: scope.branchId, isActive: { $ne: false } }).select("displayName email role permissions companyCode").lean();
    if (!cashier || !await hasEffectiveRetailCapability({ ...cashier, id: cashierId }, "operate")) throw new ValidationError("SHIFT_CASHIER_INVALID", "Nhân viên không có quyền POS hoặc không thuộc chi nhánh.");
    const drawerId = String(input.drawerId || "").trim();
    const drawer = drawerId && Types.ObjectId.isValid(drawerId) ? await RetailPosDrawerModel.findOne({ _id: drawerId, ...scope, isActive: true }).lean() : null;
    if (drawerId && !drawer) throw new ValidationError("SHIFT_DRAWER_REQUIRED", "Quầy/két được chọn không hợp lệ.");
    const now = new Date();
    const officialSchedule = await resolveRetailShiftSchedule(scope.companyCode, cashierId, now);
    const sessionBusinessDate = businessDateInVietnam(now);
    if (await CashierShiftModel.exists({ ...scope, cashierId, status: "open" })) {
      throw new ConflictError("SHIFT_ALREADY_OPEN", "Nhân viên đã có một phiên POS đang mở.");
    }
    try {
      const [shift] = await CashierShiftModel.create([{
        ...scope, ...(drawer ? { drawerId, drawerName: drawer.name } : {}), shiftCode: `POS-${scope.branchId}-${new Types.ObjectId()}`,
        cashierId, cashierName: cashier.displayName || cashier.email, openingFloat,
        openedAt: now, openedBy: actorId(actor), grossSales: 0, collectedAmount: 0,
        newDebtAmount: 0, refundedAmount: 0, netCollectedAmount: 0, methodTotals: [],
        ...officialSchedule.snapshot, expectedCash: openingFloat, status: "open", businessDate: sessionBusinessDate,
        operationalEndsAt: posSessionOperationalEndsAt(sessionBusinessDate), activityVersion: 0,
        openedByName: actorName(actor), auditLog: [audit(actor, "open", drawer ? `Giao két ${drawer.name}` : undefined)],
      }]);
      emitSessionChange("pos:session:opened", shift);
      return shift;
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictError("SHIFT_ALREADY_OPEN", "Quầy POS này đã có một phiên đang mở.");
      throw error;
    }
  },
  async close(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const manager = await hasEffectiveRetailCapability(actor, "manager");
    const countedCash = manager && input.countedCash != null ? Number(input.countedCash) : undefined;
    if (countedCash !== undefined && (!Number.isSafeInteger(countedCash) || countedCash < 0)) throw new Error("Tiền thực đếm không hợp lệ.");
    const session = await mongoose.startSession();
    let closed: any = null;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const shift: any = await CashierShiftModel.findOne({ _id: id, ...scope, ...(manager ? {} : { cashierId: actorId(actor), terminalId: String(input.terminalId || "default") }), status: "open" }).session(session);
        if (!shift) throw new ConflictError("SHIFT_NOT_OPEN", "Phiên POS không còn mở.");
        if (!isRetailShiftOperational(shift, now)) throw new ConflictError("SHIFT_EXPIRED", "Phiên POS đã hết hạn lúc 00:00; phiên đang được tự đóng.");
        const orders = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).session(session).lean();
        const totals = summarizeShift(shift, orders);
        await capturePosSession(shift, orders, session, now);
        const varianceAmount = countedCash == null ? undefined : countedCash - totals.expectedCash;
        const settings = await getResolvedRetailSettings(scope);
        const reason = manager ? String(input.varianceReason || "").trim() : "";
        if (manager && varianceAmount != null && varianceNeedsReason(varianceAmount, settings.varianceReasonThreshold) && !reason) throw missingVarianceReasonError();
        Object.assign(shift, totals, { countedCash, varianceAmount, varianceReason: reason || undefined, status: "closed", closingMode: "manual", closedAt: now, closedBy: actorId(actor) });
        if (countedCash != null) { shift.countedBy = actorId(actor); shift.countedAt = now; }
        shift.auditLog.push(audit(actor, "close", reason || undefined));
        shift.activityVersion = Number(shift.activityVersion || 0) + 1;
        await shift.save({ session });
        if (!isRetailShiftOperational(shift, new Date())) throw new ConflictError("SHIFT_EXPIRED", "Phiên đã hết hạn lúc 00:00; hệ thống sẽ chốt tự động.");
        closed = shift.toObject();
      });
    } finally { await session.endSession(); }
    emitSessionChange("pos:session:closed", closed);
    return closed;
  },
  async reconcile(scope: RetailBranchScope, id: string, input: any, actor: any) {
    const countedCash = Number(input.countedCash);
    if (!Number.isSafeInteger(countedCash) || countedCash < 0) throw new Error("Tiền thực đếm không hợp lệ.");
    const shift: any = await CashierShiftModel.findOne({ _id: id, ...scope, status: "closed" });
    if (!shift) throw new ConflictError("SHIFT_ALREADY_CLOSED", "Phiên không còn chờ đối soát.");
    if (shift.countedCash != null && countedCash !== shift.countedCash) throw new ValidationError("SHIFT_COUNT_IMMUTABLE", "Không được thay đổi tiền kiểm đếm đã gửi.");
    const varianceAmount = countedCash - Number(shift.expectedCash || 0);
    const settings = await getResolvedRetailSettings(scope);
    const reason = String(input.varianceReason || shift.varianceReason || "").trim();
    if (varianceNeedsReason(varianceAmount, settings.varianceReasonThreshold) && !reason) throw missingVarianceReasonError();
    const reconciled = await CashierShiftModel.findOneAndUpdate(
      { _id: id, ...scope, status: "closed", updatedAt: shift.updatedAt },
      { $set: { countedCash, countedBy: shift.countedBy || actorId(actor), countedAt: shift.countedAt || new Date(), varianceAmount, varianceReason: reason || shift.varianceReason || undefined, status: "reconciled", approvedBy: actorId(actor), approvedByName: actorName(actor), approvedAt: new Date() }, $push: { auditLog: audit(actor, "reconcile", reason || shift.varianceReason) } },
      { returnDocument: "after" },
    );
    if (!reconciled) throw new ConflictError("SHIFT_ALREADY_CLOSED", "Phiên POS đã được đối soát ở nơi khác.");
    emitSessionChange("pos:session:reconciled", reconciled);
    return reconciled;
  },
};
