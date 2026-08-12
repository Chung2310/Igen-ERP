import mongoose, { Types, type ClientSession } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import type { PostReceivableEntryInput, RetailReceivableEntryType } from "../interfaces/retail-receivable.interface";
import { RetailReceivableEntryModel } from "../models/retail-receivable-entry.model";

export function signedReceivableAmount(type: RetailReceivableEntryType, amount: number): number {
  return type === "payment" || type === "reversal" ? -amount : amount;
}

export function normalizeReceivableEntryInput(input: PostReceivableEntryInput) {
  const amount = Number(input.amount);
  const customerId = String(input.customerId || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const reason = String(input.reason || "").trim() || undefined;
  if (input.type === "adjustment" && input.direction && input.direction !== "increase" && input.direction !== "decrease") throw new Error("Invalid adjustment direction.");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Số tiền công nợ phải là số nguyên VNĐ dương.");
  if (!customerId || !idempotencyKey) throw new Error("Khách hàng và idempotency key là bắt buộc.");
  if ((input.type === "adjustment" || input.type === "reversal") && !reason) throw new Error("Bút toán điều chỉnh hoặc đảo cần lý do.");
  return {
    type: input.type,
    customerId,
    ...(input.orderId ? { orderId: String(input.orderId).trim() } : {}),
    amount,
    signedAmount: input.type === "adjustment" && input.direction === "decrease" ? -amount : signedReceivableAmount(input.type, amount),
    ...(reason ? { reason } : {}),
    ...(input.reversesEntryId ? { reversesEntryId: String(input.reversesEntryId).trim() } : {}),
    idempotencyKey,
  };
}

export function normalizeManualAdjustmentInput(input: any): PostReceivableEntryInput {
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!idempotencyKey) throw new Error("Adjustment idempotency key is required.");
  const direction = String(input.direction || "increase");
  if (direction !== "increase" && direction !== "decrease") throw new Error("Invalid adjustment direction.");
  return {
    type: "adjustment",
    customerId: input.customerId,
    orderId: input.orderId,
    amount: input.amount,
    reason: input.reason,
    direction,
    idempotencyKey,
  };
}

export async function postReceivableEntry(scope: RetailBranchScope, input: PostReceivableEntryInput, actor: any, session: ClientSession) {
  const values = normalizeReceivableEntryInput(input);
  const [entry] = await RetailReceivableEntryModel.create([{
    ...scope,
    ...values,
    createdBy: String(actor.id || actor.uid || ""),
    createdByName: String(actor.displayName || actor.email || ""),
  }], { session });
  return entry;
}

export const RetailReceivableLedgerService = {
  async adjust(scope: RetailBranchScope, input: any, actor: any) {
    const session = await mongoose.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        result = await postReceivableEntry(scope, normalizeManualAdjustmentInput(input), actor, session);
      });
      return result;
    } finally { await session.endSession(); }
  },
  async reverse(scope: RetailBranchScope, entryId: string, reason: string, actor: any) {
    if (!Types.ObjectId.isValid(entryId)) throw new Error("Mã bút toán công nợ không hợp lệ.");
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) throw new Error("Lý do đảo bút toán là bắt buộc.");
    const session = await mongoose.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const original: any = await RetailReceivableEntryModel.findOne({ _id: entryId, ...scope }).session(session);
        if (!original) throw new Error("Không tìm thấy bút toán công nợ.");
        const [entry] = await RetailReceivableEntryModel.create([{
          ...scope, customerId: original.customerId, orderId: original.orderId, type: "reversal",
          amount: Math.abs(original.signedAmount), signedAmount: -original.signedAmount,
          reason: normalizedReason, reversesEntryId: String(original._id), idempotencyKey: `reversal:${original._id}`,
          createdBy: String(actor.id || actor.uid || ""), createdByName: String(actor.displayName || actor.email || ""),
        }], { session });
        result = entry;
      });
      return result;
    } finally { await session.endSession(); }
  },
};
