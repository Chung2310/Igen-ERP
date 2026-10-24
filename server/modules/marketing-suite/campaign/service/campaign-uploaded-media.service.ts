import mongoose from "mongoose";
import { withCampaignSlotEdit, syncCampaignSheetFields } from "./campaign-slot-edit";
import { randomUUID } from "crypto";
import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import { broadcastEvent } from "../../shared/socket";

const EDITABLE_MEDIA_STATUSES = ["planned", "queued", "awaiting_assets", "pending_approval", "needs_attention", "failed", "retrying", "generating_media"];
const mediaFields = ["videoUrl", "imageUrl", "mediaUrls", "mediaType"];
const error = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export async function assertCampaignContentLinks(companyCode: string, changes: Record<string, unknown>, existing?: Record<string, unknown>) {
  for (const key of ["campaignId", "campaignSlotId"]) {
    if (existing?.campaignSlotId && key in changes && String(changes[key] || "") !== String(existing[key] || "")) {
      throw error("Không thể đổi liên kết chiến dịch của bài đăng đã gắn với slot.", 409);
    }
  }
  const slotId = changes.campaignSlotId ?? existing?.campaignSlotId;
  const campaignId = changes.campaignId ?? existing?.campaignId;
  if (campaignId) {
    if (!mongoose.isValidObjectId(campaignId) || !await MarketingCampaignModel.exists({ _id: campaignId, companyCode })) {
      throw error("Bạn không có quyền truy cập chiến dịch này.", 403);
    }
  }
  if (!slotId) return;
  if (!mongoose.isValidObjectId(slotId)) throw error("ID slot không hợp lệ.");
  const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, companyCode }).lean();
  if (!slot || (campaignId && String(slot.campaignId) !== String(campaignId))) {
    throw error("Slot không thuộc chiến dịch hoặc doanh nghiệp của bạn.", 403);
  }
  if (slot.marketingContentId && String(slot.marketingContentId) !== String(existing?._id || "")) {
    throw error("Slot đã được gắn với một bài đăng khác.", 409);
  }
  changes.campaignId = String(slot.campaignId);
  if (!existing?.campaignSlotId && ["processing", "published"].includes(String(existing?.status))) {
    throw error("Không thể gắn bài đang đăng hoặc đã đăng vào slot Campaign qua API sửa bài.", 409);
  }
  if (["scheduledDate", "scheduledTime", "integrationId"].some(key => key in changes && String(changes[key] ?? "") !== String(existing?.[key] ?? ""))
    || (changes.status === "scheduled" && existing?.status !== "scheduled")) {
    throw error("Lịch và Fanpage của bài Campaign phải được cập nhật qua luồng lên lịch Campaign.", 409);
  }
  const publicationFields = ["facebookPostId", "postUrl", "publishedAt", "publishError", "tiktokPostId", "tiktokPublishId", "tiktokShareUrl", "tiktokProvider", "tiktokLastWebhookEvent", "tiktokWebhookUpdatedAt"];
  if (publicationFields.some((key) => key in changes && String(changes[key] ?? "") !== String(existing?.[key] ?? ""))
    || ("status" in changes && changes.status !== existing?.status && (["processing", "published", "failed"].includes(String(changes.status)) || ["processing", "published"].includes(String(existing?.status))))) {
    throw error("Trạng thái và kết quả đăng bài Campaign chỉ được cập nhật qua luồng xuất bản.", 409);
  }
  if (mediaFields.some((key) => key in changes)) {
    for (const key of ["videoUrl", "imageUrl"]) {
      if (changes[key] && (typeof changes[key] !== "string" || !/^https:\/\//i.test(String(changes[key])))) {
        throw error("Media chiến dịch phải dùng liên kết HTTPS.");
      }
    }
    if (slot.platform === "TikTok" && changes.mediaType === "image") throw error("TikTok chỉ chấp nhận video.");
    if (!EDITABLE_MEDIA_STATUSES.includes(slot.status) || (slot.lockExpiresAt && slot.lockExpiresAt > new Date())) {
      throw error("Slot đang xử lý hoặc đã được duyệt đăng. Hãy đưa bài về bước duyệt trước khi đổi media.", 409);
    }
  }
}

export interface UploadedSlotMediaInput {
  companyCode: string;
  campaignId: string;
  slotId: string;
  urls: string[];
  mediaType: "image" | "video";
  contentId?: string;
  expectedUpdatedAt?: Date;
}

export async function assertUploadedSlotMediaInput(input: UploadedSlotMediaInput) {
  const slot = await MarketingCampaignSlotModel.findOne({ _id: input.slotId, campaignId: input.campaignId, companyCode: input.companyCode }).lean();
  if (!slot) throw error("Không tìm thấy slot thuộc doanh nghiệp này.", 403);
  if (input.expectedUpdatedAt && Number(slot.updatedAt) !== Number(input.expectedUpdatedAt)) {
    throw error("Slot đã thay đổi. Hãy tải lại trước khi đổi media.", 409);
  }
  if (input.contentId && slot.marketingContentId && String(slot.marketingContentId) !== input.contentId) {
    throw error("Bài đăng không khớp với slot chiến dịch.", 409);
  }
  if (!EDITABLE_MEDIA_STATUSES.includes(slot.status)) throw error("Slot không còn cho phép đổi media.", 409);
  if (slot.platform === "TikTok" && input.mediaType !== "video") throw error("TikTok chỉ chấp nhận video.");
  const urls = [...new Set(input.urls.filter(Boolean))];
  if (urls.some((url) => !/^https:\/\//i.test(url))) throw error("Media chiến dịch phải dùng liên kết HTTPS.");
  if (slot.lockExpiresAt && slot.lockExpiresAt > new Date()) throw error("Slot đang xử lý media. Vui lòng thử lại sau.", 409);
  return { slot, urls };
}

/** Persist the slot inputs before enqueueing; the worker still verifies/captions the uploaded video. */
export async function syncUploadedSlotMedia(input: UploadedSlotMediaInput, persistContent?: (lease: { lockId: string }) => Promise<void>) {
  const { slot, urls } = await assertUploadedSlotMediaInput(input);
  const contentId = input.contentId || (slot.marketingContentId ? String(slot.marketingContentId) : undefined);
  const hasContent = Boolean(contentId);
  const canProcess = hasContent && !["planned", "queued", "retrying"].includes(slot.status);
  const nextStatus = canProcess ? (urls.length ? "generating_media" : "awaiting_assets") : slot.status;
  const lockId = randomUUID();
  const now = new Date();
  const resetFields = ["mediaIngestionFingerprint", "ingestedMedia", "visualAnalysis", "approvedBy", "approvedAt", "tiktokPublishOptions", "lastError"];
  const rollbackSet: Record<string, unknown> = { lockId: null, lockedAt: null, lockExpiresAt: null };
  const rollbackUnset: Record<string, 1> = {};
  const previous = slot as unknown as Record<string, unknown>;
  for (const key of ["realImageDriveUrls", "realImageDirectUrls", "mediaSource", "mediaType", "status", "marketingContentId", ...resetFields]) {
    if (previous[key] === undefined) rollbackUnset[key] = 1;
    else rollbackSet[key] = previous[key];
  }
  const claimed = await MarketingCampaignSlotModel.findOneAndUpdate(
    {
      _id: slot._id, companyCode: input.companyCode, campaignId: input.campaignId,
      status: slot.status, marketingContentId: slot.marketingContentId || null,
      ...(slot.updatedAt ? { updatedAt: slot.updatedAt } : {}),
      $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: new Date() } }],
    },
    {
      // Persist the requested inputs under the lease before writing Order/card.
      // A retry can reconstruct the card from these inputs after a partial save.
      $set: { realImageDriveUrls: [], realImageDirectUrls: urls, mediaSource: "upload", mediaType: input.mediaType, status: nextStatus, lockId, lockedAt: now, lockExpiresAt: new Date(now.getTime() + 20 * 60_000), ...(contentId ? { marketingContentId: contentId } : {}) },
      $unset: Object.fromEntries(resetFields.map((key) => [key, 1])),
      $push: { transitions: { from: slot.status, to: nextStatus, reason: "Đã ghi nhận nguồn media mới trước khi đồng bộ Order và bài đăng.", at: now } },
    },
    { returnDocument: "after" }
  ).lean();
  if (!claimed) throw error("Slot đã được xử lý ở nơi khác. Hãy tải lại trước khi đổi media.", 409);
  let persisted = false;
  try {
    await persistContent?.({ lockId });
    persisted = true;
    if (contentId) {
      const synced = await MarketingContentModel.updateOne(
      { _id: contentId, companyCode: input.companyCode, campaignSlotId: slot._id },
      {
        $set: { mediaType: input.mediaType, mediaUrls: urls, videoUrl: input.mediaType === "video" ? urls[0] || "" : "", imageUrl: input.mediaType === "image" ? urls[0] || "" : "" },
        $unset: { sourceVideoUrl: 1, videoCaptionProjectId: 1 },
      }
      );
      if (synced.matchedCount === 0) throw error("Không tìm thấy bài đăng để đồng bộ media.", 404);
    }
    const updated = await MarketingCampaignSlotModel.updateOne(
      { _id: slot._id, companyCode: input.companyCode, lockId, status: nextStatus },
      {
        $set: { realImageDriveUrls: [], realImageDirectUrls: urls, mediaSource: "upload", mediaType: input.mediaType, status: nextStatus, lockId: null, lockedAt: null, lockExpiresAt: null, ...(contentId ? { marketingContentId: contentId } : {}) },
        $unset: { mediaIngestionFingerprint: 1, ingestedMedia: 1, visualAnalysis: 1, approvedBy: 1, approvedAt: 1, tiktokPublishOptions: 1, lastError: 1 },
        $push: { transitions: { from: nextStatus, to: nextStatus, reason: urls.length ? "Đã nhận media khách hàng cung cấp; kiểm tra lại trước khi duyệt đăng." : "Chờ khách hàng bổ sung media.", at: new Date() } },
      }
    );
    if (!updated.modifiedCount) throw error("Slot đã được xử lý ở nơi khác. Hãy tải lại trước khi đổi media.", 409);
  } catch (cause) {
    await MarketingCampaignSlotModel.updateOne(
      { _id: slot._id, companyCode: input.companyCode, lockId },
      persisted ? {
        $set: { lockId: null, lockedAt: null, lockExpiresAt: null, status: "needs_attention", lastError: { type: "retryable", message: "Nguồn media mới đã lưu nhưng chưa đồng bộ hoàn tất. Vui lòng thử lại.", occurredAt: new Date() } },
        $push: { transitions: { from: nextStatus, to: "needs_attention", reason: "Giữ nguồn media mới để khôi phục sau lỗi đồng bộ.", at: new Date() } },
      } : {
        $set: rollbackSet, $unset: rollbackUnset,
        $push: { transitions: { from: nextStatus, to: slot.status, reason: "Thao tác lưu bị từ chối; đã khôi phục trạng thái media trước đó.", at: new Date() } },
      }
    );
    throw cause;
  }
  broadcastEvent("campaign:slot-update", { slotId: String(slot._id), campaignId: input.campaignId, companyCode: input.companyCode, status: nextStatus, updatedAt: new Date().toISOString() });
  if (nextStatus === "generating_media") {
    try {
      const { campaignQueueService } = await import("../queue/campaign-queue");
      await campaignQueueService.addMediaJob(String(slot._id));
    } catch {
      const failed = await MarketingCampaignSlotModel.updateOne(
        { _id: slot._id, companyCode: input.companyCode, status: "generating_media", lockId: null },
        {
          $set: { status: "needs_attention", lastError: { type: "retryable", message: "Không thể đưa media vào hàng đợi. Vui lòng thử lại.", occurredAt: new Date() } },
          $push: { transitions: { from: "generating_media", to: "needs_attention", reason: "Không thể đưa media vào hàng đợi; dữ liệu đã lưu và có thể thử lại.", at: new Date() } },
        }
      );
      if (failed.modifiedCount) broadcastEvent("campaign:slot-update", { slotId: String(slot._id), campaignId: input.campaignId, companyCode: input.companyCode, status: "needs_attention", updatedAt: new Date().toISOString() });
      // The media and Order/card have already been persisted. Return their saved
      // result so the caller keeps its revision and can retry the queue safely.
    }
  }
}

export async function syncCampaignContentMedia(content: Record<string, unknown>, changes: Record<string, unknown>, persistContent?: (session?: mongoose.ClientSession) => Promise<void>) {
  const changesText = ["title", "bodyText", "outline", "mediaPrompt"].some((key) => key in changes);
  const changesMedia = mediaFields.some((key) => key in changes);
  if (!content.campaignSlotId || (!changesMedia && !changesText)) {
    await persistContent?.();
    return;
  }
  const companyCode = String(content.companyCode), campaignId = String(content.campaignId), slotId = String(content.campaignSlotId);
  for (const key of ["title", "bodyText"]) if (key in changes && (typeof changes[key] !== "string" || !String(changes[key]).trim())) throw error("Nội dung và tiêu đề bài đăng không được để trống.");
  if (!changesMedia) {
    return withCampaignSlotEdit({ companyCode, campaignId, slotId, statuses: ["pending_approval", "ready_to_publish", "needs_attention", "failed"] }, async (slot, session) => {
      if (String(slot.marketingContentId || "") !== String(content._id)) throw error("Bài đăng không khớp với slot chiến dịch.", 409);
      if (slot.platform === "TikTok" && String(changes.bodyText || "").length > 2200) throw error("Caption TikTok không được vượt quá 2.200 ký tự.");
      await persistContent?.(session);
      await syncCampaignSheetFields(companyCode, campaignId, slotId, changes, session);
      const saved = await MarketingCampaignSlotModel.updateOne({ _id: slot._id, companyCode, lockId: slot.lockId }, {
        $set: { status: "pending_approval" }, $unset: { approvedBy: 1, approvedAt: 1, tiktokPublishOptions: 1 },
        $push: { transitions: { from: slot.status, to: "pending_approval", reason: "Nội dung bài đăng đã sửa; cần duyệt lại.", at: new Date() } },
      }, { session });
      if (!saved.matchedCount) throw error("Slot đã thay đổi. Hãy tải lại trước khi lưu.", 409);
    });
  }
  const mediaType = content.mediaType === "video" || content.mediaType === "human-video" ? "video" : "image";
  const primary = mediaType === "video" ? content.videoUrl : content.imageUrl;
  const urls = "mediaUrls" in changes && Array.isArray(content.mediaUrls)
    ? content.mediaUrls.map((url) => { if (typeof url !== "string") throw error("Media chiến dịch phải dùng liên kết HTTPS."); return url; })
    : typeof primary === "string" && primary ? [primary] : [];
  await syncUploadedSlotMedia({
    companyCode: String(content.companyCode), campaignId: String(content.campaignId), slotId: String(content.campaignSlotId), contentId: String(content._id), mediaType,
    urls,
  }, changesText ? async (lease) => {
    await MarketingCampaignSlotModel.db.transaction(async (session) => {
      const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, companyCode, campaignId,
        lockId: lease.lockId, lockExpiresAt: { $gt: new Date() } }).session(session);
      if (!slot) throw error("Slot đã thay đổi. Hãy tải lại trước khi lưu.", 409);
      if (slot.platform === "TikTok" && String(changes.bodyText || "").length > 2200) throw error("Caption TikTok không được vượt quá 2.200 ký tự.");
      await persistContent?.(session);
      await syncCampaignSheetFields(companyCode, campaignId, slotId, changes, session);
      const saved = await MarketingCampaignSlotModel.updateOne({ _id: slot._id, companyCode, lockId: slot.lockId }, { $set: { lockExpiresAt: slot.lockExpiresAt } }, { session });
      if (!saved.matchedCount) throw error("Slot đã thay đổi. Hãy tải lại trước khi lưu.", 409);
    });
  } : persistContent ? () => persistContent() : undefined);
}
