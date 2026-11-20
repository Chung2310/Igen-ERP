import { logger } from "../config/logger";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomInt, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { TransactionModel } from "../model/transaction.model";
import { WalletModel } from "../model/wallet.model";
import { CompanyWalletModel } from "../model/ai-access.model";
const companyWalletEnabled = () => process.env.AI_COMPANY_WALLET_ENABLED === "true";

type BillingContext = { userId: string; task: string; companyCode?: string; failure?: Error };
const context = new AsyncLocalStorage<BillingContext>();
export const isAiBillingActive = () => Boolean(context.getStore());
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export const isAiBillingError = (error: any) => error?.code === "AI_BILLING_ERROR";
const billingError = (message: string, status = 503) => Object.assign(new Error(message), {
  code: "AI_BILLING_ERROR", status, statusCode: status,
});

export function getAiExchangeRate() {
  const value = Number(process.env.AI_USD_TO_VND?.trim() || "25400");
  if (!Number.isFinite(value) || value <= 0) throw billingError("Tỷ giá tính phí AI chưa hợp lệ.");
  return value;
}

export function aiCostToCredits(costUSD: number, usdToVnd = getAiExchangeRate()) {
  if (!finite(costUSD) || !Number.isFinite(usdToVnd) || usdToVnd <= 0) throw billingError("Chi phí AI chưa hợp lệ.");
  // The wallet deposit contract is 100 VND per Credit. Keep small API charges visible.
  const credits = Number((costUSD * usdToVnd / 100).toFixed(6));
  if (!Number.isFinite(credits)) throw billingError("Chi phí AI vượt giới hạn xử lý.");
  return credits;
}

async function lookupCost(provider: string, generationId?: string): Promise<number | undefined> {
  if (provider !== "openrouter" || !generationId || !process.env.OPENROUTER_API_KEY) return undefined;
  try {
    const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`, {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return finite(data.data?.total_cost) ? data.data.total_cost : undefined;
  } catch { return undefined; }
}

/** Pending provider charges are durable; new deposits can settle them without a negative wallet. */
export async function settlePendingAiCharges(userId: string) {
  const pending = await TransactionModel.find({ userId, payerType: { $ne: "company" }, type: "payment", status: "pending", aiUsage: { $exists: true } })
    .sort({ createdAt: 1, _id: 1 }).limit(100).lean();
  for (const item of pending) {
    let costUSD = item.aiUsage?.costUSD;
    if (!finite(costUSD)) {
      costUSD = await lookupCost(item.aiUsage!.provider, item.aiUsage!.generationId);
      if (!finite(costUSD)) break; // Missing accounting is never treated as free usage.
      await TransactionModel.updateOne({ _id: item._id, status: "pending", "aiUsage.costUSD": { $exists: false } }, {
        $set: { "aiUsage.costUSD": costUSD, amount: aiCostToCredits(costUSD, item.aiUsage!.usdToVnd) },
      });
    }
    const session = await mongoose.startSession();
    try {
      const paid = await session.withTransaction(async () => {
        const charge = await TransactionModel.findOne({ _id: item._id, userId, status: "pending" }).session(session);
        if (!charge) return true;
        if (charge.amount > 0) {
          const wallet = await WalletModel.findOneAndUpdate({ userId, balance: { $gte: charge.amount } }, [{
            $set: { balance: { $round: [{ $subtract: ["$balance", charge.amount] }, 6] }, updatedAt: new Date() },
          }], { session, returnDocument: "after" });
          if (!wallet) return false;
        }
        await TransactionModel.updateOne({ _id: charge._id, status: "pending" }, {
          $set: { status: "success", completedAt: new Date() },
        }, { session });
        return true;
      });
      if (!paid) break;
    } finally { await session.endSession(); }
  }
}

export async function settlePendingCompanyAiCharges(companyCode: string) {
  const pending = await TransactionModel.find({ payerType: "company", payerId: companyCode, type: "payment", status: "pending", aiUsage: { $exists: true } })
    .sort({ createdAt: 1, _id: 1 }).limit(100).lean();
  for (const item of pending) {
    let costUSD = item.aiUsage?.costUSD;
    if (!finite(costUSD)) {
      costUSD = await lookupCost(item.aiUsage!.provider, item.aiUsage!.generationId);
      if (!finite(costUSD)) break;
      await TransactionModel.updateOne({ _id: item._id, status: "pending", "aiUsage.costUSD": { $exists: false } },
        { $set: { "aiUsage.costUSD": costUSD, amount: aiCostToCredits(costUSD, item.aiUsage!.usdToVnd) } });
    }
    const session = await mongoose.startSession();
    try {
      const paid = await session.withTransaction(async () => {
        const charge = await TransactionModel.findOne({ _id: item._id, payerType: "company", payerId: companyCode, status: "pending" }).session(session);
        if (!charge) return true;
        if (charge.amount > 0) {
          const wallet = await CompanyWalletModel.findOneAndUpdate({ companyCode, balance: { $gte: charge.amount } }, [{
            $set: { balance: { $round: [{ $subtract: ["$balance", charge.amount] }, 6] }, updatedAt: new Date() },
          }], { session, returnDocument: "after" });
          if (!wallet) return false;
        }
        await TransactionModel.updateOne({ _id: charge._id, status: "pending" },
          { $set: { status: "success", completedAt: new Date() } }, { session });
        return true;
      });
      if (!paid) break;
    } finally { await session.endSession(); }
  }
}

export async function withAiBilling<T>(userId: string, task: string, work: () => Promise<T>, companyCode?: string): Promise<T> {
  if (!userId) throw billingError("Không xác định được tài khoản thanh toán AI.", 401);
  return context.run({ userId, task, companyCode: companyCode && companyWalletEnabled() ? companyCode : undefined }, async () => {
    if (companyCode && companyWalletEnabled()) await settlePendingCompanyAiCharges(companyCode);
    else await settlePendingAiCharges(userId);
    try {
      const result = await work();
      if (context.getStore()!.failure) throw context.getStore()!.failure;
      return result;
    } catch (error) { throw context.getStore()!.failure || error; }
  });
}

export async function beforeAiProviderCall() {
  const actor = context.getStore();
  if (!actor) return;
  if (actor.failure) throw actor.failure;
  try {
    getAiExchangeRate();
    const unpaid = await TransactionModel.findOne(actor.companyCode
      ? { payerType: "company", payerId: actor.companyCode, type: "payment", status: "pending", aiUsage: { $exists: true } }
      : { userId: actor.userId, payerType: { $ne: "company" }, type: "payment", status: "pending", aiUsage: { $exists: true } }).lean();
    if (unpaid) throw billingError(finite(unpaid.aiUsage?.costUSD)
      ? actor.companyCode ? "AI của doanh nghiệp tạm ngừng. Vui lòng liên hệ quản trị viên." : "Số dư ví không đủ để thanh toán chi phí AI đã phát sinh. Vui lòng nạp thêm Credit."
      : "Chi phí API đang chờ đối soát. Vui lòng thử lại sau.", finite(unpaid.aiUsage?.costUSD) ? 402 : 503);
    const wallet = actor.companyCode ? await CompanyWalletModel.findOne({ companyCode: actor.companyCode }).lean() : await WalletModel.findOne({ userId: actor.userId }).lean();
    if (!wallet || wallet.balance <= 0) throw billingError(actor.companyCode
      ? "AI của doanh nghiệp tạm ngừng. Vui lòng liên hệ quản trị viên."
      : "Số dư ví không đủ. Vui lòng nạp thêm Credit để sử dụng AI.", 402);
  } catch (error: any) {
    actor.failure = isAiBillingError(error) ? error : billingError("Không thể kiểm tra số dư ví. Vui lòng thử lại.");
    throw actor.failure;
  }
}

/** Called for each successful provider response, before parsing/grounding can discard usage. */
export async function recordAiProviderUsage(data: any, model: string, provider = "openrouter") {
  const actor = context.getStore();
  if (!actor) return;
  const generationId = typeof data.id === "string" && data.id ? data.id : undefined;
  const aiRequestId = `${provider}:${generationId || randomUUID()}`;
  try {
    const costUSD = finite(data.usage?.cost) ? data.usage.cost : await lookupCost(provider, generationId);
    const usdToVnd = getAiExchangeRate();
    const amount = finite(costUSD) ? aiCostToCredits(costUSD, usdToVnd) : 0;
    await TransactionModel.init();
    let recorded = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await TransactionModel.create({
          userId: actor.userId, ...(actor.companyCode ? { payerType: "company", payerId: actor.companyCode } : {}), orderCode: randomInt(10000000, 100000000), type: "payment", status: "pending", amount,
          aiRequestId, description: `AI · ${actor.task} · ${data.model || model}`,
          aiUsage: { provider, generationId, task: actor.task, model: data.model || model, costUSD, usdToVnd,
            promptTokens: finite(data.usage?.prompt_tokens) ? data.usage.prompt_tokens : undefined,
            completionTokens: finite(data.usage?.completion_tokens) ? data.usage.completion_tokens : undefined },
        });
        recorded = true; break;
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        const existing = await TransactionModel.findOne({ aiRequestId }).lean();
        if (existing) {
          if (existing.userId !== actor.userId || (actor.companyCode && existing.payerId !== actor.companyCode))
            throw billingError("Giao dịch AI không thuộc tài khoản hiện tại.");
          recorded = true; break;
        }
      }
    }
    if (!recorded) throw billingError("Không thể ghi nhận giao dịch AI.");
    if (actor.companyCode) await settlePendingCompanyAiCharges(actor.companyCode);
    else await settlePendingAiCharges(actor.userId);
    const transaction = await TransactionModel.findOne({ aiRequestId }).lean();
    if (transaction?.status !== "success") throw billingError(finite(transaction?.aiUsage?.costUSD)
      ? actor.companyCode ? "AI của doanh nghiệp tạm ngừng. Vui lòng liên hệ quản trị viên." : "Số dư ví không đủ để thanh toán chi phí AI đã phát sinh. Vui lòng nạp thêm Credit."
      : "Chi phí API đang chờ đối soát. Vui lòng thử lại sau.", finite(transaction?.aiUsage?.costUSD) ? 402 : 503);
  } catch (error: any) {
    logger.error("[AiBilling] Unable to settle provider usage", { aiRequestId, userId: actor.userId, code: error?.code });
    actor.failure = isAiBillingError(error) ? error : billingError("Chưa thể ghi nhận chi phí AI. Vui lòng thử lại sau.");
    throw actor.failure;
  }
}
