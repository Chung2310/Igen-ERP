import { Types, type ClientSession } from "mongoose";
import { CashierShiftModel } from "../models/cashier-shift.model";
import type { RetailBranchScope } from "../contracts";
import { ConflictError } from "../../../errors/app-error";
import { hasEffectiveRetailCapability } from "../permissions";
import { summarizeShift } from "./cashier-shift.service";
import { RetailOrderModel } from "../models/retail-order.model";

export function assertPaymentSessionDeadline(shift: any) {
  if (shift && (!shift.operationalEndsAt || new Date(shift.operationalEndsAt).getTime() < Date.now())) {
    throw new ConflictError("CASH_SESSION_CLOSED", "Phiên đã hết hạn lúc 00:00. Giao dịch chưa được ghi nhận; vui lòng mở phiên mới.");
  }
}

// Called inside the money transaction, after checking the idempotency gate.
export async function lockRetailPaymentSession(scope: RetailBranchScope, input: any, actor: any, session: ClientSession, hasCash: boolean, cashOut = 0) {
  const id = String(input.cashSessionId || "");
  if (!id) {
    if (hasCash) throw new ConflictError("CASH_SESSION_REQUIRED", "Chọn phiên/két đang mở để ghi nhận tiền mặt.");
    return undefined;
  }
  if (!Types.ObjectId.isValid(id)) throw new ConflictError("CASH_SESSION_REQUIRED", "Mã phiên thu/hoàn tiền không hợp lệ.");
  const manager = await hasEffectiveRetailCapability(actor, "manager");
  const now = new Date();
  const shift = await CashierShiftModel.findOneAndUpdate({ _id: id, ...scope, status: "open", operationalEndsAt: { $gte: now },
    ...(manager ? {} : { cashierId: String(actor.id || actor.uid || ""), terminalId: String(input.terminalId || "default") }),
  }, { $inc: { activityVersion: 1 }, $set: { lastActivityAt: now } }, { session, returnDocument: "after" });
  if (!shift) throw new ConflictError("CASH_SESSION_CLOSED", "Phiên thu/hoàn tiền đã đóng hoặc không thuộc quyền của bạn.");
  if (cashOut > 0) {
    const orders = await RetailOrderModel.find({ ...scope, $or: [{ shiftId: id }, { "payments.shiftId": id }, { "refunds.shiftId": id }] }).session(session).lean();
    if (cashOut > summarizeShift(shift, orders).expectedCash) throw new ConflictError("SHIFT_CASH_INSUFFICIENT", "Két không đủ tiền mặt. Quản lý cần bổ sung quỹ trước khi chi.");
  }
  return shift;
}
