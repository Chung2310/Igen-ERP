import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import { campaignQueueService } from "../queue/campaign-queue";
import { recordFacebookPublication } from "./facebook-publication.service";
import { broadcastEvent } from "../../shared/socket";

const RECOVERY_BATCH_LIMIT = 100;
const FACEBOOK_CALLBACK_TIMEOUT_MS = 30 * 60_000;
const PREPARE_PHASES = ["generating", "researching", "writing", "scoring"] as const;

/** Recover persisted work; provider requests with an unknown outcome require review. */
export async function recoverCampaignSlots(options?: { campaignId?: string }) {
  const now = new Date();
  const campaigns = await MarketingCampaignModel.find({ status: "active", ...(options?.campaignId ? { _id: options.campaignId } : {}) }).select("_id companyCode").lean();
  if (!campaigns.length) return;
  const scope = { $or: campaigns.map((campaign) => ({ campaignId: campaign._id, companyCode: campaign.companyCode })) };
  const unlocked = [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }];
  const expired = await MarketingCampaignSlotModel.find({ $and: [scope, { $or: unlocked }], status: { $in: PREPARE_PHASES } }).limit(RECOVERY_BATCH_LIMIT).lean();
  for (const slot of expired) {
    const terminal = (slot.attemptCount || 0) >= 2;
    const status = terminal ? "needs_attention" : "retrying";
    await MarketingCampaignSlotModel.updateOne(
      { _id: slot._id, companyCode: slot.companyCode, status: slot.status, lockId: slot.lockId || null, $or: unlocked },
      {
        $set: { status, prepareAt: now, lockId: null, lockedAt: null, lockExpiresAt: null, lastError: { type: terminal ? "terminal" : "retryable", message: "Worker chuẩn bị nội dung đã hết lease; khôi phục từ dữ liệu đã lưu.", occurredAt: now } },
        $inc: { attemptCount: 1 },
        $push: { transitions: { from: slot.status, to: status, reason: "Recovered expired prepare worker lease", at: now } },
      }
    );
  }

  const pending = await MarketingCampaignSlotModel.find({ $and: [scope, { $or: unlocked }], status: { $in: ["generating_media", "verifying"] } }).limit(RECOVERY_BATCH_LIMIT).lean();
  for (const slot of pending) {
    try {
      if (slot.status === "generating_media") await campaignQueueService.addMediaJob(String(slot._id));
      else await campaignQueueService.addVerifyJob(String(slot._id));
    } catch {
      const terminal = (slot.attemptCount || 0) >= 2;
      await MarketingCampaignSlotModel.updateOne(
        { _id: slot._id, companyCode: slot.companyCode, status: slot.status, $or: unlocked },
        {
          $set: { ...(terminal ? { status: "needs_attention" } : {}), lastError: { type: terminal ? "terminal" : "retryable", message: "Không thể khôi phục hàng đợi xử lý chiến dịch.", occurredAt: now } },
          $inc: { attemptCount: 1 },
          $push: { transitions: { from: slot.status, to: terminal ? "needs_attention" : slot.status, reason: "Recovery enqueue failed", at: now } },
        }
      );
    }
  }

  const cutoff = new Date(now.getTime() - FACEBOOK_CALLBACK_TIMEOUT_MS);
  const waiting = await MarketingCampaignSlotModel.find({ $and: [scope, { $or: unlocked }], platform: "Facebook", status: "publishing", publishRequestedAt: { $lte: cutoff } }).limit(RECOVERY_BATCH_LIMIT).lean();
  for (const slot of waiting) {
    const content = slot.marketingContentId && await MarketingContentModel.findOne({ _id: slot.marketingContentId, companyCode: slot.companyCode, campaignSlotId: slot._id }).lean();
    if (content?.status === "published" && content.facebookPostId) {
      await recordFacebookPublication(String(content._id), { status: "published", postId: content.facebookPostId, postUrl: content.postUrl }, slot.companyCode);
      continue;
    }
    const message = "Quá thời gian chờ callback Facebook. Hãy kiểm tra bài trên Fanpage trước khi thử đăng lại.";
    const changed = await MarketingCampaignSlotModel.updateOne(
      { _id: slot._id, companyCode: slot.companyCode, status: "publishing", publishRequestedAt: slot.publishRequestedAt, $or: unlocked },
      {
        $set: { status: "needs_attention", lockId: null, lockedAt: null, lockExpiresAt: null, lastError: { type: "terminal", message, occurredAt: now } },
        $push: { transitions: { from: "publishing", to: "needs_attention", reason: message, at: now } },
      }
    );
    if (!changed.modifiedCount) continue;
    if (content) await MarketingContentModel.updateOne(
      { _id: content._id, companyCode: slot.companyCode, campaignSlotId: slot._id, status: { $in: ["processing", "pending"] } },
      { $set: { status: "failed", publishError: message } }
    );
    const current = await MarketingCampaignSlotModel.findOne({ _id: slot._id, companyCode: slot.companyCode }).select("status").lean();
    if (current) broadcastEvent("campaign:slot-update", { slotId: String(slot._id), campaignId: String(slot.campaignId), companyCode: slot.companyCode, status: current.status, updatedAt: now.toISOString() });
  }
}
