import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { AiSubscriptionPeriodModel, AiSubscriptionPlanModel, AiUsageModel } from "../model/ai-subscription.model";
import { CompanyModel } from "../../../../model/company.model";
import { MarketingCampaignModel } from "../../campaign/model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../../campaign/model/marketing-campaign-slot.model";

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
  async assign(companyCode: string, planId: string, actorId: string) {
    companyCode = companyCode.trim().toUpperCase();
    return AiSubscriptionPeriodModel.db.transaction(async (session) => {
      if (!await CompanyModel.exists({ code: companyCode }).session(session)) throw quotaError("Không tìm thấy doanh nghiệp.", 404);
      const plan = await AiSubscriptionPlanModel.findOne({ _id: planId, active: true }).session(session);
      if (!plan) throw quotaError("Không tìm thấy gói đang được cung cấp.", 404);
      const startsAt = new Date();
      await AiSubscriptionPeriodModel.updateMany({ companyCode, status: "active" }, { $set: { status: "replaced" } }, { session });
      const [period] = await AiSubscriptionPeriodModel.create([{
        companyCode, planId: plan._id, planName: plan.name, aiLimit: plan.aiLimit,
        priceVnd: plan.priceVnd ?? null,
        startsAt, expiresAt: new Date(startsAt.getTime() + plan.durationDays * 86_400_000), createdBy: actorId,
      }], { session });
      return period;
    });
  },
  async recoverExpired(companyCode: string) {
    const ids = await AiUsageModel.find({ companyCode, status: "reserved", expiresAt: { $lte: new Date() } }).select("_id").limit(100).lean();
    if (!ids.length) return;
    await AiUsageModel.db.transaction(async (session) => {
      const expired = await AiUsageModel.find({ _id: { $in: ids.map((item) => item._id) }, companyCode, status: "reserved", expiresAt: { $lte: new Date() } }).session(session);
      for (const usage of expired) {
        const changed = await AiUsageModel.updateOne({ _id: usage._id, status: "reserved" },
          { $set: { status: "released", completedAt: new Date(), reason: "reservation_expired" } }, { session });
        if (changed.modifiedCount) {
          const period = await AiSubscriptionPeriodModel.updateOne({ _id: usage.subscriptionId, reserved: { $gte: usage.units } }, { $inc: { reserved: -usage.units } }, { session });
          if (!period.matchedCount) throw new Error("Không thể giải phóng lượt AI đang giữ.");
        }
      }
    });
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
        { $set: { status: success ? "succeeded" : "released", completedAt: new Date() } }, { returnDocument: "after", session });
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

/** One successful provider call is one unit; failed retries share the same hold. */
export async function billAiCall<T>(kind: string, model: string, action: () => Promise<T>): Promise<T> {
  const context = getAiUsageContext();
  if (!context) throw quotaError("Thiếu phạm vi doanh nghiệp cho tác vụ AI.", 403);
  const usage = await aiSubscriptionService.reserve(context, kind, model);
  let completed = false;
  try {
    const result = await action();
    completed = true;
    await aiSubscriptionService.finish(usage._id, true);
    context.usageIds?.push(String(usage._id));
    return result;
  } catch (error) {
    if (!completed) await aiSubscriptionService.finish(usage._id, false);
    throw error;
  }
}

export async function attachAiUsageToCampaign(campaignId: string) {
  const context = getAiUsageContext();
  if (!context?.usageIds?.length) return;
  await AiUsageModel.db.transaction(async (session) => {
    const changed = await AiUsageModel.updateMany({ _id: { $in: context.usageIds }, companyCode: context.companyCode, status: "succeeded", campaignId: { $exists: false } },
      { $set: { campaignId } }, { session });
    if (changed.modifiedCount) await MarketingCampaignModel.updateOne({ _id: campaignId, companyCode: context.companyCode }, { $inc: { "statistics.aiCallsUsed": changed.modifiedCount } }, { session });
  });
}
