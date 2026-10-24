import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ClientSession } from "mongoose";
import { AiSubscriptionPeriodModel, AiSubscriptionPlanModel, AiUsageModel } from "../model/ai-subscription.model";
import { CompanyModel } from "../../../../model/company.model";
import { MarketingCampaignModel } from "../../campaign/model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../../campaign/model/marketing-campaign-slot.model";
import { readAiSettlementIntents, removeAiSettlementIntent, writeAiSettlementIntent } from "./ai-settlement-journal";

export interface AiUsageContext { companyCode: string; userId?: string; campaignId?: string; slotId?: string; usageIds?: string[] }
const contexts = new AsyncLocalStorage<AiUsageContext>();
export const getAiUsageContext = () => contexts.getStore();
export function withAiUsage<T>(context: AiUsageContext, action: () => T): T {
  const companyCode = context.companyCode?.trim().toUpperCase();
  if (!companyCode) throw quotaError("Không xác định được doanh nghiệp sử dụng AI.", 403);
  return contexts.run({ ...context, companyCode, usageIds: context.usageIds || [] }, action);
}
export function quotaError(message: string, statusCode = 402) {
  return Object.assign(new Error(message), { statusCode, status: statusCode, code: "AI_SUBSCRIPTION_LIMIT" });
}
function subscriptionConflict(message: string) {
  return Object.assign(new Error(message), { statusCode: 409, code: "AI_SUBSCRIPTION_CONFLICT" });
}

export const aiSubscriptionService = {
  async summary(companyCode: string) {
    companyCode = companyCode.trim().toUpperCase();
    const value = await AiSubscriptionPeriodModel.findOne({ companyCode, status: "active" }).lean();
    if (!value) return null;
    return { ...value, remaining: Math.max(0, value.aiLimit - value.used - value.reserved),
      status: value.expiresAt <= new Date() ? "expired" as const : value.status };
  },
  async available(companyCode: string, units = 1) {
    companyCode = companyCode.trim().toUpperCase();
    await this.recoverExpired(companyCode);
    const subscription = await this.summary(companyCode);
    if (!subscription || subscription.status !== "active" || subscription.startsAt > new Date()) {
      throw quotaError("Doanh nghiệp chưa có gói AI còn hiệu lực. Vui lòng liên hệ Superadmin.");
    }
    if (subscription.remaining < units) throw quotaError(`Gói AI còn ${subscription.remaining} lượt, tác vụ cần ${units} lượt.`);
    return subscription;
  },
  async assign(companyCode: string, planId: string, actorId: string, expectedSubscriptionId: string | null, planUpdatedAt: string | Date, existingSession?: ClientSession) {
    companyCode = companyCode.trim().toUpperCase();
    const apply = async (session: ClientSession) => {
      if (!await CompanyModel.exists({ code: companyCode }).session(session)) throw quotaError("Không tìm thấy doanh nghiệp.", 404);
      const current = await AiSubscriptionPeriodModel.findOne({ companyCode, status: "active" }).session(session);
      if ((current ? String(current._id) : null) !== expectedSubscriptionId) {
        throw subscriptionConflict("Kỳ sử dụng của doanh nghiệp đã thay đổi. Hãy tải lại trước khi cấp gói.");
      }
      const plan = await AiSubscriptionPlanModel.findOne({ _id: planId, active: true }).session(session);
      if (!plan) throw subscriptionConflict("Gói đã thay đổi hoặc ngừng cung cấp. Hãy tải lại danh mục trước khi cấp gói.");
      if (plan.updatedAt.getTime() !== new Date(planUpdatedAt).getTime()) {
        throw subscriptionConflict("Giá hoặc cấu hình gói đã thay đổi. Hãy tải lại danh mục và chọn lại gói.");
      }
      if (plan.priceVnd == null) throw subscriptionConflict("Gói chưa được thiết lập giá. Hãy cập nhật gói trước khi cấp mới.");
      const startsAt = new Date();
      const carry = current && current.startsAt <= startsAt && current.expiresAt > startsAt;
      const carriedOver = carry ? Math.max(0, current.aiLimit - current.used) : 0;
      const held = carry ? current.reserved : 0;
      const aiLimit = plan.aiLimit + carriedOver;
      if (!Number.isSafeInteger(aiLimit)) throw subscriptionConflict("Tổng hạn mức vượt giới hạn cho phép.");
      await AiSubscriptionPeriodModel.updateMany({ companyCode, status: "active" }, { $set: { status: "replaced" } }, { session });
      const [period] = await AiSubscriptionPeriodModel.create([{
        companyCode, planId: plan._id, planName: plan.name, aiLimit, carriedOver, reserved: held,
        priceVnd: plan.priceVnd ?? null,
        startsAt, expiresAt: new Date(startsAt.getTime() + plan.durationDays * 86_400_000), createdBy: actorId,
      }], { session });
      if (carry && current) {
        await AiUsageModel.updateMany({ subscriptionId: current._id, companyCode, status: "reserved" }, { $set: { subscriptionId: period._id } }, { session });
        await AiSubscriptionPeriodModel.updateOne({ _id: current._id, companyCode }, { $set: { reserved: 0 } }, { session });
      }
      return period;
    };
    return existingSession ? apply(existingSession) : AiSubscriptionPeriodModel.db.transaction(apply);
  },
  async cancel(companyCode: string, subscriptionId: string, session?: ClientSession) {
    const period = await AiSubscriptionPeriodModel.findOneAndUpdate({
      _id: subscriptionId, companyCode: companyCode.trim().toUpperCase(), status: "active", expiresAt: { $gt: new Date() },
    }, { $set: { status: "cancelled" } }, { returnDocument: "after", session });
    if (!period) throw subscriptionConflict("Kỳ sử dụng đã thay đổi hoặc hết hiệu lực. Hãy tải lại trước khi thu hồi.");
    return period;
  },
  async recoverExpired(companyCode: string) {
    const recorded = await AiUsageModel.find({ companyCode, status: "reserved", providerOutcome: { $in: ["succeeded", "failed"] } }).select("_id providerOutcome").limit(100).lean();
    for (const usage of recorded) await this.finish(usage._id, usage.providerOutcome === "succeeded");
    // A timeout alone cannot prove that the provider failed. Keep unknown outcomes held for reconciliation.
    await AiUsageModel.updateMany({ companyCode, status: "reserved", providerOutcome: { $exists: false }, expiresAt: { $lte: new Date() }, reason: { $ne: "provider_outcome_unknown" } },
      { $set: { reason: "provider_outcome_unknown" } });
  },
  async reserve(context: AiUsageContext, kind: string, model?: string) {
    await this.recoverExpired(context.companyCode);
    return AiUsageModel.db.transaction(async (session) => {
      const now = new Date();
      const period = await AiSubscriptionPeriodModel.findOneAndUpdate({
        companyCode: context.companyCode, status: "active", startsAt: { $lte: now }, expiresAt: { $gt: now },
        $expr: { $lt: [{ $add: ["$used", "$reserved"] }, "$aiLimit"] },
      }, { $inc: { reserved: 1 } }, { returnDocument: "after", session });
      if (!period) throw quotaError("Gói AI đã hết lượt hoặc hết hạn. Vui lòng liên hệ Superadmin.");
      const [usage] = await AiUsageModel.create([{
        companyCode: context.companyCode, userId: context.userId, campaignId: context.campaignId, slotId: context.slotId,
        subscriptionId: period._id, requestKey: randomUUID(), kind, model, units: 1,
        expiresAt: new Date(now.getTime() + 60 * 60_000),
      }], { session });
      return usage;
    });
  },
  async finish(usageId: unknown, success: boolean) {
    return AiUsageModel.db.transaction(async (session) => {
      const usage = await AiUsageModel.findOneAndUpdate({ _id: usageId, status: "reserved" },
        { $set: { status: success ? "succeeded" : "released", providerOutcome: success ? "succeeded" : "failed", completedAt: new Date() } }, { returnDocument: "after", session });
      if (!usage) {
        const settled = await AiUsageModel.findById(usageId).session(session);
        if (settled?.status === (success ? "succeeded" : "released")) return;
        throw quotaError("Lượt AI đã hết thời gian giữ lượt hoặc đã được đối soát khác trạng thái.", 409);
      }
      const changed = await AiSubscriptionPeriodModel.updateOne({ _id: usage.subscriptionId, reserved: { $gte: usage.units } },
        { $inc: { reserved: -usage.units, used: success ? usage.units : 0 } }, { session });
      if (!changed.matchedCount) throw new Error("Không thể đối soát hạn mức AI.");
      if (success && usage.campaignId) await MarketingCampaignModel.updateOne({ _id: usage.campaignId, companyCode: usage.companyCode }, { $inc: { "statistics.aiCallsUsed": usage.units } }, { session });
      if (success && usage.slotId) await MarketingCampaignSlotModel.updateOne({ _id: usage.slotId, companyCode: usage.companyCode, campaignId: usage.campaignId }, { $inc: { aiCallsUsed: usage.units } }, { session });
    });
  },
};

/** Retry only ledger writes. The provider request is never repeated during settlement. */
async function settleAiCall(usageId: string, companyCode: string, success: boolean) {
  let journaled = false;
  let outcomeRecorded = false;
  try { await writeAiSettlementIntent({ usageId, companyCode, success, recordedAt: new Date().toISOString() }); journaled = true; }
  catch { console.warn("[AI quota] Local settlement journal unavailable; attempting database settlement."); }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const recorded = await AiUsageModel.updateOne({ _id: usageId, companyCode, status: "reserved" }, { $set: { providerOutcome: success ? "succeeded" : "failed" } });
      outcomeRecorded ||= recorded.matchedCount > 0;
      await aiSubscriptionService.finish(usageId, success);
      if (journaled) await removeAiSettlementIntent(usageId).catch(() => undefined);
      return;
    } catch {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  if (!journaled && !outcomeRecorded) throw Object.assign(new Error("Lượt AI đang chờ đối soát. Vui lòng kiểm tra lại hạn mức trước khi thử lại."), { statusCode: 503, code: "AI_USAGE_SETTLEMENT_PENDING" });
  console.warn(`[AI quota] Usage ${usageId} queued for settlement recovery.`);
}

let recovery: Promise<void> | null = null;
export function recoverPendingAiSettlements(): Promise<void> {
  if (recovery) return recovery;
  recovery = (async () => {
    for (const intent of await readAiSettlementIntents()) {
      try {
        await AiUsageModel.updateOne({ _id: intent.usageId, companyCode: intent.companyCode, status: "reserved" }, { $set: { providerOutcome: intent.success ? "succeeded" : "failed" } });
        await aiSubscriptionService.finish(intent.usageId, intent.success);
        await removeAiSettlementIntent(intent.usageId);
      } catch { /* The intent remains durable until the ledger is reconciled. */ }
    }
    const pending = await AiUsageModel.find({ status: "reserved", providerOutcome: { $in: ["succeeded", "failed"] } }).select("_id providerOutcome").limit(100).lean();
    for (const usage of pending) {
      try { await aiSubscriptionService.finish(usage._id, usage.providerOutcome === "succeeded"); }
      catch { /* Retry in the next bounded recovery pass. */ }
    }
  })().finally(() => { recovery = null; });
  return recovery;
}

/** One successful provider call is one unit; failed retries share the same hold. */
export async function billAiCall<T>(kind: string, model: string, action: () => Promise<T>): Promise<T> {
  const context = getAiUsageContext();
  if (!context) throw quotaError("Thiếu phạm vi doanh nghiệp cho tác vụ AI.", 403);
  const usage = await aiSubscriptionService.reserve(context, kind, model);
  let completed = false;
  try {
    const result = await action();
    completed = true;
    await settleAiCall(String(usage._id), context.companyCode, true);
    context.usageIds?.push(String(usage._id));
    return result;
  } catch (error) {
    if (!completed) await settleAiCall(String(usage._id), context.companyCode, false);
    throw error;
  }
}

export async function attachAiUsageToCampaign(campaignId: string) {
  const context = getAiUsageContext();
  if (!context?.usageIds?.length) return;
  await AiUsageModel.db.transaction(async (session) => {
    const filter = { _id: { $in: context.usageIds }, companyCode: context.companyCode, status: { $in: ["reserved", "succeeded"] as const }, campaignId: { $exists: false } };
    const usages = await AiUsageModel.find(filter).select("status units").session(session).lean();
    await AiUsageModel.updateMany(filter,
      { $set: { campaignId } }, { session });
    const settledUnits = usages.filter((usage) => usage.status === "succeeded").reduce((sum, usage) => sum + usage.units, 0);
    if (settledUnits) await MarketingCampaignModel.updateOne({ _id: campaignId, companyCode: context.companyCode }, { $inc: { "statistics.aiCallsUsed": settledUnits } }, { session });
  });
}
