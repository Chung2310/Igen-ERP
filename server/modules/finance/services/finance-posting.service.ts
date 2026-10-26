import mongoose, { type ClientSession } from "mongoose";
import type { FinanceBranchScope } from "../contracts";
import { FinanceClosedPeriodModel, FinancePostingGuardModel } from "../models/finance-treasury.model";
import { invalid } from "./financial-calculations";
/** Strict transactions are required for money transfers and debt settlement; no standalone fallback. */
export async function financeTransaction<T>(scope: FinanceBranchScope, work: (session: ClientSession) => Promise<T>): Promise<T> {
  try { await FinancePostingGuardModel.updateOne(scope, { $setOnInsert: { ...scope, revision: 0 } }, { upsert: true }); }
  catch (e: any) { if (e.code !== 11000) throw e; }
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { await FinancePostingGuardModel.updateOne(scope, { $inc: { revision: 1 } }, { session }); result = await work(session); });
    return result;
  } finally { await session.endSession(); }
}
export async function assertCashPeriodOpen(scope: FinanceBranchScope, day: string, session?: ClientSession) {
  if (await FinanceClosedPeriodModel.exists({ ...scope, month: { $gte: day.slice(0, 7) }, status: "closed" }).session(session ?? null)) throw invalid("Kỳ này hoặc kỳ sau đã chốt. Cần mở lại kỳ và ghi lý do trước khi ghi sổ thu/chi.", 409);
}
