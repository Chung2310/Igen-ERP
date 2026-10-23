import { MarketingContentModel } from "../model/marketing-content.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { broadcastEvent } from "../../shared/socket";

type PublicationStatus = "published" | "processing" | "failed";
export interface FacebookPublication {
  status: PublicationStatus;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/** Atomic card updates keep a late callback or HTTP acknowledgement from undoing publication. */
export async function recordFacebookPublication(cardId: string, input: FacebookPublication, companyCode?: string) {
  const card = await MarketingContentModel.findOne({ _id: cardId, ...(companyCode ? { companyCode } : {}) }).lean();
  if (!card) return null;
  const postId = String(input.postId || card.facebookPostId || "").trim();
  if (input.status === "published" && !postId) {
    throw Object.assign(new Error("Chưa có Facebook Post ID xác nhận bài đăng hoàn tất."), { statusCode: 400 });
  }
  const set: Record<string, unknown> = { status: input.status };
  const unset: Record<string, 1> = {};
  if (input.postId) set.facebookPostId = input.postId;
  if (input.postUrl) set.postUrl = input.postUrl;
  if (input.status === "published") set.publishedAt = card.publishedAt || new Date();
  if (input.status === "failed") set.publishError = input.error || "Đăng bài thất bại qua n8n";
  else unset.publishError = 1;
  const updated = await MarketingContentModel.findOneAndUpdate(
    {
      _id: card._id, companyCode: card.companyCode,
      ...(input.status !== "published" ? { status: { $nin: input.status === "processing" ? ["published", "failed"] : ["published"] } } : { $or: [{ status: { $ne: "published" } }, { facebookPostId: postId }, { facebookPostId: { $in: [null, ""] } }] }),
    },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return await MarketingContentModel.findOne({ _id: card._id, companyCode: card.companyCode }).lean();
  if (updated.campaignSlotId) {
    const scope = { _id: updated.campaignSlotId, companyCode: updated.companyCode, marketingContentId: updated._id, ...(updated.campaignId ? { campaignId: updated.campaignId } : {}) };
    let slotChanged = false;
    if (input.status === "processing") {
      const changed = await MarketingCampaignSlotModel.updateOne(
        { ...scope, status: { $nin: ["published", "needs_attention", "cancelled", "skipped"] } },
        { $set: { status: "publishing", ...(postId ? { publishedPostId: postId } : {}) } }
      );
      slotChanged = changed.modifiedCount > 0;
    } else {
      const published = input.status === "published";
      const transitioned = await MarketingCampaignSlotModel.findOneAndUpdate(
        { ...scope, status: { $nin: published ? ["published"] : ["published", "needs_attention"] } },
        {
          $set: published
            ? { status: "published", publishedPostId: postId, publishedUrl: updated.postUrl, lockId: null, lockedAt: null, lockExpiresAt: null }
            : { status: "needs_attention", lastError: { type: "provider", message: updated.publishError, occurredAt: new Date() }, lockId: null, lockedAt: null, lockExpiresAt: null },
          $push: { transitions: { from: "publishing", to: published ? "published" : "needs_attention", reason: published ? "Facebook n8n confirmed publication" : updated.publishError, at: new Date() } },
        },
        { returnDocument: "before" }
      );
      if (transitioned) {
        slotChanged = true;
        const increments = {
          ...(published ? { "statistics.publishedSlots": 1 } : {}),
          ...(transitioned.status === "failed" ? { "statistics.failedSlots": -1 } : {}),
        };
        if (Object.keys(increments).length) {
          await MarketingCampaignModel.updateOne(
            { _id: transitioned.campaignId, companyCode: updated.companyCode },
            { $inc: increments }
          );
        }
      }
    }
    if (input.status === "published") {
      const publishedSlot = await MarketingCampaignSlotModel.findOne({ ...scope, status: "published" }).select("campaignId").lean();
      if (publishedSlot) {
        // Dynamic import avoids the campaign service -> publisher -> callback cycle.
        // Recompute on duplicate callbacks too, so an interrupted sync is recoverable.
        const { marketingCampaignService } = await import("./marketing-campaign.service");
        await marketingCampaignService.syncCampaignStatusAndStats(publishedSlot.campaignId);
      }
    }
    if (slotChanged) broadcastEvent("campaign:slot-update", { slotId: String(updated.campaignSlotId), campaignId: updated.campaignId, companyCode: updated.companyCode, status: input.status === "processing" ? "publishing" : input.status === "failed" ? "needs_attention" : "published", updatedAt: new Date().toISOString() });
  }
  return updated;
}
