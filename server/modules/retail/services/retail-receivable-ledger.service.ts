import type { ClientSession } from "mongoose";
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
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Số tiền công nợ phải là số nguyên VNĐ dương.");
  if (!customerId || !idempotencyKey) throw new Error("Khách hàng và idempotency key là bắt buộc.");
  if ((input.type === "adjustment" || input.type === "reversal") && !reason) throw new Error("Bút toán điều chỉnh hoặc đảo cần lý do.");
  return {
    type: input.type,
    customerId,
    ...(input.orderId ? { orderId: String(input.orderId).trim() } : {}),
    amount,
    signedAmount: signedReceivableAmount(input.type, amount),
    ...(reason ? { reason } : {}),
    ...(input.reversesEntryId ? { reversesEntryId: String(input.reversesEntryId).trim() } : {}),
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
