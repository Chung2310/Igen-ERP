import type { ClientSession } from "mongoose";
import { UserModel } from "../../../../model/user.model";
import { AiSubscriptionPlanModel, AiUsageModel } from "../model/ai-subscription.model";
import { AiUserSubscriptionModel } from "../model/ai-user-subscription.model";

function conflict(message: string) {
  return Object.assign(new Error(message), { statusCode: 409, code: "AI_SUBSCRIPTION_CONFLICT" });
}
export const aiUserSubscriptionService = {
  async summary(userId: string) {
    const value = await AiUserSubscriptionModel.findOne({ userId, status: "active" }).lean();
    if (!value) return null;
    return { ...value, remaining: Math.max(0, value.aiLimit - value.used - value.reserved),
      status: value.expiresAt <= new Date() ? "expired" as const : value.status };
  },
  async assign(userId: string, planId: string, actorId: string, expectedSubscriptionId: string | null, planUpdatedAt: string, session: ClientSession) {
    const user = await UserModel.findById(userId).select("companyCode role").session(session).lean();
    if (!user || !user.companyCode || user.role === "superadmin") throw Object.assign(new Error("Không tìm thấy người dùng hợp lệ."), { statusCode: 404 });
    const current = await AiUserSubscriptionModel.findOne({ userId, status: "active" }).session(session);
    if ((current ? String(current._id) : null) !== expectedSubscriptionId) throw conflict("Gói người dùng đã thay đổi. Hãy tải lại.");
    const plan = await AiSubscriptionPlanModel.findOne({ _id: planId, active: true }).session(session);
    if (!plan || plan.priceVnd == null || plan.updatedAt.getTime() !== new Date(planUpdatedAt).getTime()) throw conflict("Gói AI đã thay đổi. Hãy tải lại danh mục.");
    const startsAt = new Date();
    const carry = current && current.companyCode === user.companyCode && current.startsAt <= startsAt && current.expiresAt > startsAt;
    const carried = carry ? Math.max(0, current.aiLimit - current.used) : 0;
    const held = carry ? current.reserved : 0;
    await AiUserSubscriptionModel.updateMany({ userId, status: "active" }, { $set: { status: "replaced" } }, { session });
    const [period] = await AiUserSubscriptionModel.create([{
      userId: user._id, companyCode: user.companyCode, planId: plan._id, planName: plan.name,
      priceVnd: plan.priceVnd, aiLimit: plan.aiLimit + carried, reserved: held,
      startsAt, expiresAt: new Date(startsAt.getTime() + plan.durationDays * 86_400_000), createdBy: actorId,
    }], { session });
    if (carry && current) {
      await AiUsageModel.updateMany({ subscriptionId: current._id, billingScope: "user", status: "reserved" }, { $set: { subscriptionId: period._id } }, { session });
      await AiUserSubscriptionModel.updateOne({ _id: current._id }, { $set: { reserved: 0 } }, { session });
    }
    return period;
  },
  async cancel(userId: string, subscriptionId: string, session: ClientSession) {
    const value = await AiUserSubscriptionModel.findOneAndUpdate({ _id: subscriptionId, userId, status: "active", expiresAt: { $gt: new Date() } },
      { $set: { status: "cancelled" } }, { returnDocument: "after", session });
    if (!value) throw conflict("Gói người dùng đã thay đổi hoặc hết hạn. Hãy tải lại.");
    return value;
  },
};
