import mongoose from "mongoose";
import { MarketingContentModel } from "../model/marketing-content.model";
import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { withCampaignSlotEdit, syncCampaignSheetFields } from "./campaign-slot-edit";
import { zonedLocalTimeToUtc } from "./marketing-campaign-schedule.service";
import { resolveFacebookCredentials } from "./agents/campaign-utils";

const conflict = (message: string) => Object.assign(new Error(message), { statusCode: 409 });

/** Keep Approval/Calendar scheduling on the campaign's existing worker pipeline. */
export async function scheduleCampaignFacebookContent(input: {
  companyCode: string;
  contentId: string;
  approvedBy: string;
  scheduledDate: string;
  scheduledTime: string;
  integrationId?: string;
}) {
  const content = await MarketingContentModel.findOne({ _id: input.contentId, companyCode: input.companyCode }).lean();
  if (!content?.campaignId || !content.campaignSlotId || content.channel !== "Facebook") {
    throw conflict("Bài đăng không khớp với slot Facebook của Campaign.");
  }
  if (input.integrationId && !mongoose.Types.ObjectId.isValid(input.integrationId)) {
    throw Object.assign(new Error("ID tích hợp không hợp lệ."), { statusCode: 400 });
  }

  return withCampaignSlotEdit({
    companyCode: input.companyCode,
    campaignId: String(content.campaignId),
    slotId: String(content.campaignSlotId),
    statuses: ["pending_approval", "ready_to_publish", "needs_attention", "failed"],
  }, async (slot, session) => {
    const card = await MarketingContentModel.findOne({
      _id: input.contentId, companyCode: input.companyCode,
      campaignId: String(slot.campaignId), campaignSlotId: slot._id,
    }).session(session);
    const campaign = await MarketingCampaignModel.findOne({
      _id: slot.campaignId, companyCode: input.companyCode, status: "active",
    }).session(session);
    if (!campaign) throw conflict("Chiến dịch không ở trạng thái đang chạy.");
    if (!card || slot.platform !== "Facebook" || String(slot.marketingContentId) !== String(card._id)) {
      throw conflict("Bài đăng không khớp với slot Facebook của Campaign.");
    }
    if (slot.publishedPostId || slot.publishRequestedAt || card.facebookPostId || ["published", "processing"].includes(card.status)) {
      throw conflict("Bài đã được gửi đăng. Hãy kiểm tra kết quả trên Facebook trước khi lên lịch lại.");
    }
    const scheduledAt = zonedLocalTimeToUtc(input.scheduledDate, input.scheduledTime, campaign.timezone);
    if (scheduledAt <= new Date() || input.scheduledDate < campaign.startDate || input.scheduledDate > campaign.endDate) {
      throw Object.assign(new Error("Lịch đăng phải ở tương lai và nằm trong thời gian chiến dịch."), { statusCode: 400 });
    }
    if (await MarketingCampaignSlotModel.exists({
      companyCode: input.companyCode, campaignId: campaign._id, platform: "Facebook",
      scheduledAt, _id: { $ne: slot._id },
    }).session(session)) throw conflict("Chiến dịch đã có bài Facebook vào thời gian này.");

    await resolveFacebookCredentials({
      companyCode: input.companyCode, createdBy: campaign.createdBy, integrationId: input.integrationId,
    });
    const now = new Date();
    // Serialize schedule changes across different slots and concurrent pause/cancel.
    const touched = await MarketingCampaignModel.updateOne(
      { _id: campaign._id, companyCode: input.companyCode, status: "active" },
      { $set: { updatedAt: now }, $inc: { __v: 1 } }, { session },
    );
    if (!touched.matchedCount) throw conflict("Chiến dịch đã thay đổi. Hãy tải lại trước khi lên lịch.");
    const previousStatus = slot.status;
    const previousSchedule = slot.scheduledAt.toISOString();
    slot.integrationId = input.integrationId ? new mongoose.Types.ObjectId(input.integrationId) : undefined;
    slot.scheduledAt = scheduledAt;
    slot.verifyAt = new Date(scheduledAt.getTime() - campaign.verificationLeadMinutes * 60_000);
    // Re-run readiness checks before the existing publish worker can claim this slot.
    // Recovery scans pick up this durable state even if the queue is unavailable now.
    slot.status = "verifying";
    slot.attemptCount = 0;
    slot.lastError = undefined;
    slot.approvedAt = now;
    slot.approvedBy = input.approvedBy;
    slot.transitions.push({ from: previousStatus, to: "verifying", reason: `Rescheduled by ${input.approvedBy}: ${previousSchedule} -> ${scheduledAt.toISOString()}`, at: now });
    card.status = "scheduled";
    card.scheduledDate = input.scheduledDate;
    card.scheduledTime = input.scheduledTime;
    card.integrationId = slot.integrationId;
    card.publishError = undefined;
    await slot.save({ session });
    await card.save({ session });
    await syncCampaignSheetFields(input.companyCode, String(campaign._id), String(slot._id), {
      scheduledAt: scheduledAt.toISOString(),
    }, session, input.approvedBy);
    return { campaignScheduled: true, slotId: String(slot._id), scheduledAt: scheduledAt.toISOString() };
  });
}
