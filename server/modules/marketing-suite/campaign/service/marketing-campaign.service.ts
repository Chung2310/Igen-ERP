import { getMarketingApprovalSecret, getMarketingAppUrl } from "../../shared/runtime-settings";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model.ts";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model.ts";
import { MarketingContentModel } from "../model/marketing-content.model.ts";
import { MarketingCampaignStatus, MarketingCampaignPlatform } from "../interface/marketing-campaign.interface.ts";
import { MarketingCampaignSlotStatus } from "../interface/marketing-campaign-slot.interface.ts";
import { buildCampaignSchedule, zonedLocalTimeToUtc } from "./marketing-campaign-schedule.service.ts";
import { geminiService } from "../../shared/service/gemini.service.ts";
import { CampaignMatrixGeneratorService } from "./agents/campaign-matrix-generator.service.ts";
import { CampaignOrchestratorService } from "./agents/campaign-orchestrator.service.ts";
import { scanAndEnqueueDueSlots } from "./campaign-scheduler.service.ts";
import { aiSubscriptionService, attachAiUsageToCampaign } from "../../shared/service/ai-subscription.service";
import { estimateCampaignAi } from "./campaign-ai-estimate";
import { listGoogleDriveFolderFiles, getGoogleDriveDirectLink } from "./marketing-campaign-helper";
import { assertCampaignDraftCanActivate } from "./marketing-campaign-activation.service.ts";
import { syncUploadedSlotMedia } from "./campaign-uploaded-media.service";
import { assertCampaignMediaReady } from "./agents/campaign-media-readiness";
import { nextCalendarDate, publicCampaignSlotScope, rememberPublicApprovalState, savePublicSlotDecision } from "./public-campaign-approval";
import { withCampaignSlotEdit, syncCampaignSheetFields } from "./campaign-slot-edit";
import { resolveFacebookCredentials, syncCampaignContentReady } from "./agents/campaign-utils";

interface CreateCampaignInput {
  sourceBrief: string;
  campaignType?: "single" | "campaign";
  startDate: string;
  endDate: string;
  postsPerDay: number;
  postingTimes: string[];
  timezone?: string;
  platforms: MarketingCampaignPlatform[];
  integrationIds?: Partial<Record<MarketingCampaignPlatform, string>>;
  candidateCount?: number;
  generationLeadMinutes?: number;
  verificationLeadMinutes?: number;
  latePublishWindowMinutes?: number;
  minimumScore?: number;
  mediaPolicy?: "text" | "image" | "video" | "auto";
  captionMode?: "none" | "speech" | "context" | "combined";
  images?: string[];
  qualityMode?: "premium" | "budget";
  publishMode?: "auto" | "manual";
  imageMode?: "ai" | "real" | "order";
  publishNow?: boolean;
  initialVideoUrl?: string;
  googleDriveFolderUrl?: string;
  customSchedule?: Record<string, string[]>;
  apifySources?: string[];
  rules?: {
    requiredCta?: string;
    requiredHashtags?: string[];
    forbiddenTerms?: string[];
    allowTextOnlyFallback?: boolean;
  };
}

const ACTIVE_SLOT_STATUSES: MarketingCampaignSlotStatus[] = [
  "planned",
  "queued",
  "generating",
  "researching",
  "writing",
  "scoring",
  "awaiting_assets",
  "generating_media",
  "verifying",
  "pending_approval",
  "ready_to_publish",
  "publishing",
  "retrying",
  "needs_attention",
];
const TIKTOK_MONTHLY_EXTERNAL_REVIEWER = "External Reviewer (Monthly · TikTok content)";

type TikTokCampaignPublishOptions = {
  caption: string;
  privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  brandContentToggle: boolean;
  brandContent: boolean;
  brandOrganic: boolean;
  isAigc: boolean;
  videoDurationSeconds: number;
  consentAccepted: boolean;
};

type TikTokBatchPublishOptions = Omit<TikTokCampaignPublishOptions, "caption" | "videoDurationSeconds">;

function validateTikTokCampaignPublishOptions(options?: TikTokCampaignPublishOptions) {
  if (typeof options?.caption !== "string" || options.caption.length > 2200) {
    throw new Error("Caption TikTok không hợp lệ.");
  }
  if (!options?.consentAccepted) {
    throw new Error("Bạn phải xác nhận điều khoản TikTok trước khi duyệt đăng.");
  }
  if (!Number.isFinite(options.videoDurationSeconds) || options.videoDurationSeconds <= 0) {
    throw new Error("Không đọc được thời lượng video TikTok. Vui lòng tải lại video trước khi đăng.");
  }
  if (options.brandContentToggle && !options.brandContent && !options.brandOrganic) {
    throw new Error("Vui lòng chọn nội dung quảng bá cho thương hiệu của bạn, đối tác hoặc cả hai.");
  }
  if (options.brandContent && options.privacyLevel === "SELF_ONLY") {
    throw new Error("Branded Content không thể đăng ở chế độ Chỉ mình tôi.");
  }
}

function assertTikTokPublicApprovalDisabled(platform: MarketingCampaignPlatform) {
  if (platform === "TikTok") {
    throw new Error("TikTok cần được duyệt trong màn hình TikTok để chọn quyền riêng tư, thời lượng và điều khoản đăng.");
  }
}

async function validateIntegrations(companyCode: string, platforms: MarketingCampaignPlatform[], integrationIds: CreateCampaignInput["integrationIds"]) {
  for (const platform of platforms) {
    const integrationId = integrationIds?.[platform];
    if (platform === "TikTok" && !integrationId) {
      throw new Error("Vui lòng chọn tài khoản TikTok doanh nghiệp đang hoạt động trước khi tạo chiến dịch.");
    }
    if (!integrationId) continue;
    if (!mongoose.Types.ObjectId.isValid(integrationId)) {
      throw new Error(`Liên kết ${platform} không hợp lệ.`);
    }
    const exists = await SocialIntegrationModel.exists({
      _id: integrationId,
      companyCode,
      platform,
      isConnected: true,
    });
    if (!exists) throw new Error(`Không tìm thấy liên kết ${platform} đang hoạt động trong doanh nghiệp.`);
  }
}

function canUseLocalMockFacebookPage() {
  return process.env.NODE_ENV !== "production" && process.env.DISABLE_LOCAL_MOCKS !== "true";
}

async function ensureLocalMockFacebookPage(companyCode: string, createdBy: string) {
  const existing = await SocialIntegrationModel.findOne({
    companyCode,
    platform: "Facebook",
    isConnected: true,
    isMock: true,
  })
    .select("_id")
    .lean();
  if (existing) return String(existing._id);

  const suffix = companyCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local";
  const integration = await SocialIntegrationModel.create({
    companyCode,
    platform: "Facebook",
    displayName: "Fanpage Facebook giả lập (local)",
    username: `mock_local_${suffix}`,
    accessToken: `mock_local_facebook_token_${randomUUID()}`,
    isConnected: true,
    isMock: true,
    createdBy,
  });
  console.log(`[Marketing Campaign] Đã tạo Fanpage Facebook giả lập cho local. company=${companyCode}`);
  return String(integration._id);
}

async function ensureLocalMockTikTokAccount(companyCode: string, createdBy: string) {
  const existing = await SocialIntegrationModel.findOne({
    companyCode,
    platform: "TikTok",
    isConnected: true,
    isMock: true,
  })
    .select("_id")
    .lean();
  if (existing) return String(existing._id);

  const suffix = companyCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local";
  const integration = await SocialIntegrationModel.create({
    companyCode,
    platform: "TikTok",
    displayName: "TikTok local mock",
    username: `mock_local_tiktok_${suffix}`,
    accessToken: `mock_local_tiktok_token_${randomUUID()}`,
    isConnected: true,
    isMock: true,
    createdBy,
  });
  console.log(`[Marketing Campaign] Local TikTok mock created. company=${companyCode}`);
  return String(integration._id);
}

export const marketingCampaignService = {
  async create(companyCode: string, createdBy: string, input: CreateCampaignInput) {
    const activateImmediately = input.campaignType === "single" && input.publishNow === true;
    const requiresTikTokVideo = input.platforms.length === 1 && input.platforms[0] === "TikTok";
    const initialVideoUrl = input.initialVideoUrl?.trim() || "";
    if (requiresTikTokVideo && (
      input.mediaPolicy !== "video"
      || input.imageMode === "ai"
      || (input.images && input.images.length > 0)
    )) {
      throw new Error("Chiến dịch TikTok chỉ nhận video. Vui lòng tải video trực tiếp cho một bài hoặc nhập video từ Google Drive và không đính kèm ảnh.");
    }
    if (requiresTikTokVideo && input.publishMode === "auto") {
      throw new Error("TikTok cần duyệt thủ công để chọn quyền riêng tư, thời lượng video và xác nhận điều khoản trước khi đăng.");
    }
    if (initialVideoUrl) {
      const isSingleTikTokPost = input.campaignType === "single"
        && input.platforms.length === 1
        && input.platforms[0] === "TikTok";
      const isCloudinaryVideo = /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(initialVideoUrl);
      if (!isSingleTikTokPost || !isCloudinaryVideo) {
        throw new Error("Video tải trực tiếp chỉ áp dụng cho một bài TikTok và phải được tải lên hệ thống.");
      }
    }
    const timezone = input.timezone || "Asia/Ho_Chi_Minh";
    const generationLeadMinutes = input.generationLeadMinutes ?? 60;
    const verificationLeadMinutes = input.verificationLeadMinutes ?? 15;
    const monthlyPreparationLeadDays = 10;
    const now = new Date();
    const schedule = buildCampaignSchedule({
      startDate: input.startDate,
      endDate: input.endDate,
      postsPerDay: input.postsPerDay,
      postingTimes: input.postingTimes,
      timezone,
      platforms: input.platforms,
      generationLeadMinutes,
      verificationLeadMinutes,
      customSchedule: input.customSchedule,
      campaignCreatedAt: now,
      monthlyPreparationLeadDays,
    });

    const minLeadTimeMs = 15 * 60 * 1000;
    if (!activateImmediately) {
      const failingSlot = schedule.find((slot) => slot.scheduledAt.getTime() - now.getTime() < minLeadTimeMs);
      if (failingSlot) {
        const formatZonedTime = (date: Date) => {
          return new Intl.DateTimeFormat("vi-VN", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(date);
        };

        const scheduledStr = formatZonedTime(failingSlot.scheduledAt);
        const nowStr = formatZonedTime(now);

        throw new Error(
          `Lịch đăng lúc ${scheduledStr} quá sát so với thời gian hiện tại (${nowStr}). Hệ thống cần ít nhất 15 phút để chuẩn bị nội dung.`
        );
      }
    }
    const integrationIds = { ...(input.integrationIds || {}) };
    if (
      canUseLocalMockFacebookPage()
      && input.platforms.includes("Facebook")
      && !integrationIds.Facebook
    ) {
      integrationIds.Facebook = await ensureLocalMockFacebookPage(companyCode, createdBy);
    }
    if (
      canUseLocalMockFacebookPage()
      && input.platforms.includes("TikTok")
      && !integrationIds.TikTok
    ) {
      integrationIds.TikTok = await ensureLocalMockTikTokAccount(companyCode, createdBy);
    }
    await validateIntegrations(companyCode, input.platforms, integrationIds);

    // New campaigns never bind Drive media before their content exists. Legacy
    // callers that still send "real" are migrated into the content-first order flow.
    const imageMode: "ai" | "order" = input.imageMode === "ai" ? "ai" : "order";
    const aiEstimate = estimateCampaignAi(input);
    await aiSubscriptionService.available(companyCode, aiEstimate.estimatedCalls);
    const researchReport = await geminiService.conductWebResearch(input.sourceBrief);
    const aiStrategy = await geminiService.generateScheduledCampaign({
      prompt: input.sourceBrief,
      startDate: input.startDate,
      endDate: input.endDate,
      postsPerDay: input.postsPerDay,
      postingTimes: input.postingTimes,
      channels: input.platforms,
      images: imageMode === "ai" ? input.images : undefined,
      customSchedule: input.customSchedule,
      researchReport,
      rules: input.rules,
    });

    if (aiStrategy.slots.length !== schedule.length) {
      throw new Error(`AI trả về ${aiStrategy.slots.length}/${schedule.length} slot chiến dịch.`);
    }

    const strategy = {
      campaignTitle: aiStrategy.campaignTitle,
      contentPillars: aiStrategy.contentPillars,
      slots: requiresTikTokVideo
        ? aiStrategy.slots.map((slot) => ({ ...slot, mediaType: "video" as const }))
        : imageMode === "order"
        ? aiStrategy.slots.map((slot) => ({
          ...slot,
          mediaType: slot.mediaType === "text" ? "image" as const : slot.mediaType,
        }))
        : aiStrategy.slots,
    };

    // Zero-Click Content Strategy Matrix Generation (Background)
    const contentMatrix = await CampaignMatrixGeneratorService.generateMatrix(
      input.sourceBrief,
      schedule.length
    );

    // Flatten all angles with their funnel tags
    const allAngles = contentMatrix.flatMap((p) => p.angles);

    const estimatedCost = aiEstimate.estimatedCalls;

    const campaign = await MarketingCampaignModel.create({
      companyCode,
      createdBy,
      title: strategy.campaignTitle,
      sourceBrief: input.sourceBrief,
      campaignType: input.campaignType || "campaign",
      researchReport,
      status: activateImmediately ? "active" : "draft",
      timezone,
      startDate: input.startDate,
      endDate: input.endDate,
      postsPerDay: input.postsPerDay,
      postingTimes: input.postingTimes,
      platforms: input.platforms,
      integrationIds,
      candidateCount: Math.min(5, Math.max(2, input.candidateCount ?? 3)),
      generationLeadMinutes,
      preparationMode: "monthly",
      monthlyPreparationLeadDays,
      preparationScheduleVersion: 2,
      verificationLeadMinutes,
      latePublishWindowMinutes: input.latePublishWindowMinutes ?? 30,
      minimumScore: input.minimumScore ?? 80,
      mediaPolicy: input.mediaPolicy || "auto",
      captionMode: input.captionMode || "none",
      contentPillars: strategy.contentPillars,
      qualityMode: input.qualityMode || "premium",
      publishMode: input.publishMode || "manual",
      imageMode,
      customSchedule: input.customSchedule,
      apifySources: input.apifySources || ["google", "facebook", "tiktok"],
      contentMatrix,
      rules: input.rules || {},
      statistics: { totalSlots: schedule.length, publishedSlots: 0, failedSlots: 0, estimatedCost: 0, actualCost: 0, aiCallsEstimated: estimatedCost, aiCallsUsed: 0 },
    });
    await attachAiUsageToCampaign(String(campaign._id));

    try {
      const slots = await MarketingCampaignSlotModel.insertMany(schedule.map((scheduledSlot, index) => {
        const brief = strategy.slots[index];
        const integrationId = integrationIds[scheduledSlot.platform];
        const slotId = new mongoose.Types.ObjectId();

        // Map funnel stage according to schedule timeline progress ratio
        // Week 1 (0% - 25%): TOFU | Week 2-3 (25% - 75%): MOFU | Week 4 (75% - 100%): BOFU
        const ratio = scheduledSlot.progressRatio;
        let funnelStage: "TOFU" | "MOFU" | "BOFU" = "MOFU";
        if (ratio <= 0.25) {
          funnelStage = "TOFU";
        } else if (ratio >= 0.75) {
          funnelStage = "BOFU";
        }

        // Try to assign matching angle if available
        const matchingAngle = allAngles.find((a) => a.funnel === funnelStage);

        const isPastOrImmediate = activateImmediately || scheduledSlot.scheduledAt.getTime() <= Date.now();
        const finalScheduledAt = isPastOrImmediate ? new Date() : scheduledSlot.scheduledAt;
        const finalPrepareAt = isPastOrImmediate ? new Date() : scheduledSlot.prepareAt;
        const mediaType = scheduledSlot.platform === "TikTok" && !["video", "human-video"].includes(brief.mediaType)
          ? "video" as const
          : brief.mediaType;

        return {
          _id: slotId,
          companyCode,
          campaignId: campaign._id,
          scheduledAt: finalScheduledAt,
          prepareAt: finalPrepareAt,
          verifyAt: scheduledSlot.verifyAt,
          platform: scheduledSlot.platform,
          integrationId,
          pillar: brief.pillar,
          objective: brief.objective,
          topicBrief: matchingAngle ? `${matchingAngle.title} — ${brief.topicBrief}` : brief.topicBrief,
          funnelStage,
          mediaType,
          mediaSource: initialVideoUrl && scheduledSlot.platform === "TikTok" ? "upload" : (mediaType === "video" || mediaType === "human-video" ? "drive" : imageMode === "ai" ? "ai" : "drive"),
          realImageDirectUrls: initialVideoUrl && scheduledSlot.platform === "TikTok" ? [initialVideoUrl] : [],
          status: "planned",
          attemptCount: 0,
          publishIdempotencyKey: `${campaign._id}:${slotId}:${scheduledSlot.platform}`,
          transitions: [{
            to: "planned",
            reason: activateImmediately ? "Campaign activated (Publish Now mode)" : "Campaign draft created for setup review",
            at: new Date(),
          }],
        };
      }));

      let preparation = { enqueued: 0, deferred: 0 };
      if (activateImmediately) {
        try {
          const initialBatch = await scanAndEnqueueDueSlots({
            campaignId: String(campaign._id),
            limit: Math.min(schedule.length, 100),
          });
          preparation = {
            enqueued: initialBatch.enqueued,
            deferred: initialBatch.deferred,
          };
        } catch (error) {
          console.error("[Marketing Campaign] Unable to enqueue the initial monthly batch:", error);
        }
      }

      return { campaign, slots, preparation };
    } catch (error) {
      await MarketingCampaignModel.deleteOne({ _id: campaign._id, companyCode });
      throw error;
    }
  },

  async syncCampaignStatusAndStats(campaignId: string | mongoose.Types.ObjectId) {
    const campaign = await MarketingCampaignModel.findById(campaignId);
    if (!campaign) return null;

    const slots = await MarketingCampaignSlotModel.find({ campaignId: campaign._id, companyCode: campaign.companyCode }).select("status").lean();
    const totalSlots = slots.length;
    if (totalSlots === 0) return campaign;

    const publishedSlots = slots.filter((s) => s.status === "published").length;
    const terminalFailedSlots = slots.filter((s) => s.status === "failed").length;
    const failedSlots = terminalFailedSlots + slots.filter((s) => s.status === "needs_attention").length;
    const cancelledSlots = slots.filter((s) => s.status === "cancelled").length;
    const skippedSlots = slots.filter((s) => s.status === "skipped").length;

    const finishedSlotsCount = publishedSlots + terminalFailedSlots + cancelledSlots + skippedSlots;

    campaign.statistics.totalSlots = totalSlots;
    campaign.statistics.publishedSlots = publishedSlots;
    campaign.statistics.failedSlots = failedSlots;

    if (finishedSlotsCount >= totalSlots && totalSlots > 0) {
      if (campaign.status === "active" || campaign.status === "paused") {
        if (publishedSlots > 0 || (publishedSlots === 0 && failedSlots === 0)) {
          campaign.status = "completed";
        } else if (failedSlots === totalSlots) {
          campaign.status = "failed";
        } else if (cancelledSlots === totalSlots) {
          campaign.status = "cancelled";
        } else {
          campaign.status = "completed";
        }
      }
    }

    await campaign.save();
    return campaign;
  },

  async list(companyCode: string, query?: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query?.limit || 10)));
    const skip = (page - 1) * limit;

    const [campaignDocs, total] = await Promise.all([
      MarketingCampaignModel.find({ companyCode })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarketingCampaignModel.countDocuments({ companyCode }),
    ]);

    const campaigns = await Promise.all(
      campaignDocs.map(async (camp) => {
        const synced = await this.syncCampaignStatusAndStats(camp._id);
        return (synced || camp).toObject();
      })
    );

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getCalendar(companyCode: string, startDate: string, endDate: string) {
    const timezone = "Asia/Bangkok";
    const startAt = zonedLocalTimeToUtc(startDate, "00:00", timezone);
    const endCursor = new Date(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(endCursor.getTime())) throw new Error("Khoảng ngày lịch không hợp lệ.");
    endCursor.setUTCDate(endCursor.getUTCDate() + 1);
    const endExclusiveDate = endCursor.toISOString().slice(0, 10);
    const endAt = zonedLocalTimeToUtc(endExclusiveDate, "00:00", timezone);
    if (endAt <= startAt) throw new Error("Khoảng ngày lịch không hợp lệ.");

    const slots = await MarketingCampaignSlotModel.find({
      companyCode,
      scheduledAt: { $gte: startAt, $lt: endAt },
    })
      .select("campaignId scheduledAt platform status mediaType topicBrief")
      .sort({ scheduledAt: 1 })
      .lean();

    const campaignIds = [...new Set(slots.map((slot) => String(slot.campaignId)))];
    const campaigns = await MarketingCampaignModel.find({
      companyCode,
      _id: { $in: campaignIds },
    })
      .select("title campaignType status")
      .lean();
    const campaignById = new Map(campaigns.map((campaign) => [String(campaign._id), campaign]));

    return {
      timezone,
      slots: slots.filter((slot) => campaignById.get(String(slot.campaignId))?.status !== "draft").map((slot) => {
        const campaign = campaignById.get(String(slot.campaignId));
        return {
          _id: String(slot._id),
          campaignId: String(slot.campaignId),
          campaignTitle: campaign?.title || "Chiến dịch",
          campaignType: campaign?.campaignType || "campaign",
          scheduledAt: slot.scheduledAt,
          platform: slot.platform,
          status: slot.status,
          mediaType: slot.mediaType,
          topicBrief: slot.topicBrief,
        };
      }),
    };
  },

  async getDetail(companyCode: string, campaignId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new Error("ID chiến dịch không hợp lệ.");
    await this.syncCampaignStatusAndStats(campaignId);
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode }).lean();
    if (!campaign) throw new Error("Không tìm thấy chiến dịch.");
    const slots = await MarketingCampaignSlotModel.find({ campaignId, companyCode })
      .sort({ scheduledAt: 1 })
      .populate("marketingContentId")
      .populate("selectedCandidateId")
      .lean();

    const transformedSlots = slots.map((slot) => {
      const contentDoc = slot.marketingContentId as unknown as {
        _id: mongoose.Types.ObjectId;
        title: string;
        bodyText: string;
        outline?: string;
        mediaPrompt?: string;
        imageUrl?: string;
        videoUrl?: string;
        mediaUrls?: string[];
        mediaType?: "image" | "video" | "human-video";
      } | null;

      const candidateDoc = slot.selectedCandidateId as unknown as {
        _id: mongoose.Types.ObjectId;
        variant: string;
      } | null;

      const content = contentDoc
        ? {
            _id: contentDoc._id,
            title: contentDoc.title,
            bodyText: contentDoc.bodyText,
            outline: contentDoc.outline,
            mediaPrompt: contentDoc.mediaPrompt,
            videoUrl: contentDoc.videoUrl,
            mediaUrls: contentDoc.mediaUrls?.length
              ? contentDoc.mediaUrls
              : (contentDoc.imageUrl ? [contentDoc.imageUrl] : (contentDoc.videoUrl ? [contentDoc.videoUrl] : [])),
            mediaType: contentDoc.mediaType,
          }
        : null;

      return {
        ...slot,
        content,
        variant: candidateDoc?.variant || null,
        errorMessage: slot.lastError?.message,
        publishedPostUrl: slot.publishedUrl,
      };
    });

    return { campaign, slots: transformedSlots };
  },

  async changeStatus(companyCode: string, campaignId: string, action: "pause" | "resume" | "cancel") {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new Error("ID chiến dịch không hợp lệ.");
    const transitions: Record<typeof action, { from: MarketingCampaignStatus[]; to: MarketingCampaignStatus }> = {
      pause: { from: ["active"], to: "paused" },
      resume: { from: ["paused"], to: "active" },
      cancel: { from: ["draft", "active", "paused", "failed"], to: "cancelled" },
    };
    const transition = transitions[action];
    const campaign = await MarketingCampaignModel.findOneAndUpdate(
      { _id: campaignId, companyCode, status: { $in: transition.from } },
      { $set: { status: transition.to } },
      { new: true }
    );
    if (!campaign) throw new Error("Trạng thái hiện tại không cho phép thao tác này.");

    if (action === "pause") {
      await MarketingCampaignSlotModel.updateMany(
        { campaignId, companyCode, status: "queued" },
        {
          $set: { status: "planned" },
          $push: {
            transitions: {
              from: "queued",
              to: "planned",
              reason: "Campaign paused before monthly preparation started",
              at: new Date(),
            },
          },
        }
      );
    }

    if (action === "cancel") {
      await MarketingCampaignSlotModel.updateMany(
        { campaignId, companyCode, status: { $in: ACTIVE_SLOT_STATUSES } },
        {
          $set: { status: "cancelled", lockId: null, lockedAt: null, lockExpiresAt: null },
          $push: { transitions: { to: "cancelled", reason: "Campaign cancelled", at: new Date() } },
        }
      );
    }
    return campaign;
  },

  async activate(companyCode: string, campaignId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new Error("ID chiến dịch không hợp lệ.");
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode, status: "draft" });
    if (!campaign) throw new Error("Chỉ bản nháp mới có thể được xác nhận khởi chạy.");

    const slots = await MarketingCampaignSlotModel.find({ campaignId, companyCode })
      .select("_id status scheduledAt platform mediaType")
      .lean();
    assertCampaignDraftCanActivate({
      slots,
      enabledPlatforms: campaign.platforms,
      timezone: campaign.timezone,
    });

    await validateIntegrations(
      companyCode,
      campaign.platforms,
      Object.fromEntries(
        campaign.platforms.map((platform) => [platform, campaign.integrationIds?.[platform]?.toString() || ""])
      )
    );

    const activatedAt = new Date();
    const activatedCampaign = await MarketingCampaignModel.findOneAndUpdate(
      { _id: campaignId, companyCode, status: "draft" },
      { $set: { status: "active" } },
      { new: true }
    );
    if (!activatedCampaign) throw new Error("Bản nháp đã được cập nhật ở nơi khác. Vui lòng tải lại.");

    await MarketingCampaignSlotModel.updateMany(
      { campaignId, companyCode, status: "planned" },
      {
        $push: {
          transitions: {
            from: "planned",
            to: "planned",
            reason: "Campaign activated after setup review",
            at: activatedAt,
          },
        },
      }
    );

    let preparation = { enqueued: 0, deferred: 0 };
    try {
      const initialBatch = await scanAndEnqueueDueSlots({
        campaignId,
        limit: Math.min(slots.length, 100),
      });
      preparation = {
        enqueued: initialBatch.enqueued,
        deferred: initialBatch.deferred,
      };
    } catch (error) {
      console.error("[Marketing Campaign] Unable to enqueue campaign after setup approval:", error);
    }

    return { campaign: activatedCampaign, preparation };
  },

  async retrySlot(companyCode: string, campaignId: string, slotId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode, status: "active" });
    if (!campaign) throw new Error("Chiến dịch không ở trạng thái đang chạy.");
    const slot = await MarketingCampaignSlotModel.findOneAndUpdate(
      { _id: slotId, campaignId, companyCode, status: { $in: ["needs_attention", "failed"] } },
      {
        $set: { status: "planned", attemptCount: 0, lockId: null, lockedAt: null, lockExpiresAt: null, lastError: null, prepareAt: new Date() },
        $push: { transitions: { to: "planned", reason: "Manual retry requested", at: new Date() } },
      },
      { new: true }
    );
    if (!slot) throw new Error("Slot không ở trạng thái cho phép thử lại.");
    return slot;
  },

  async retryAllSlots(companyCode: string, campaignId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) throw new Error("ID chiến dịch không hợp lệ.");
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode, status: "active" });
    if (!campaign) throw new Error("Chiến dịch không ở trạng thái đang chạy.");
    const result = await MarketingCampaignSlotModel.updateMany(
      { campaignId, companyCode, status: { $in: ["needs_attention", "failed"] } },
      {
        $set: { status: "planned", attemptCount: 0, lockId: null, lockedAt: null, lockExpiresAt: null, lastError: null, prepareAt: new Date() },
        $push: { transitions: { to: "planned", reason: "Bulk retry requested", at: new Date() } },
      }
    );
    return { retriedCount: result.modifiedCount };
  },

  async approveSlot(companyCode: string, campaignId: string, slotId: string, approvedBy: string, tiktokPublishOptions?: TikTokCampaignPublishOptions) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
    if (slot.lockExpiresAt && slot.lockExpiresAt > new Date()) throw Object.assign(new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi duyệt."), { statusCode: 409 });
    const allowedStatuses = ["pending_approval", "needs_attention", "failed"];
    if (!allowedStatuses.includes(slot.status)) {
      throw new Error(`Slot không thể được duyệt ở trạng thái này: ${slot.status}`);
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode });
    const content = slot.marketingContentId && await MarketingContentModel.findOne({
      _id: slot.marketingContentId, companyCode, campaignId, campaignSlotId: slot._id,
    });
    if (!campaign || !content) throw new Error("Không tìm thấy nội dung bài đăng của slot chiến dịch.");
    await assertCampaignMediaReady({ campaign, slot, content });
    if (slot.platform === "TikTok") {
      validateTikTokCampaignPublishOptions(tiktokPublishOptions);
      slot.tiktokPublishOptions = tiktokPublishOptions;
    }

    const now = new Date();
    const approved = await MarketingCampaignSlotModel.db.transaction(async (session) => {
      const updated = await MarketingCampaignSlotModel.findOneAndUpdate(
        { _id: slot._id, campaignId, companyCode, status: slot.status, updatedAt: slot.updatedAt, $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
        {
          $set: { status: "ready_to_publish", approvedBy, approvedAt: now, ...(slot.platform === "TikTok" ? { tiktokPublishOptions } : {}) },
          $push: { transitions: { from: slot.status, to: "ready_to_publish", reason: `Approved manually by ${approvedBy}`, at: now } },
        },
        { new: true, session }
      );
      if (updated) await syncCampaignContentReady(updated, session);
      return updated;
    });
    if (!approved) throw Object.assign(new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi duyệt."), { statusCode: 409 });
    return approved;
  },

  async approveTikTokSlots(
    companyCode: string,
    campaignId: string,
    slotIds: string[],
    approvedBy: string,
    tiktokPublishOptions: TikTokBatchPublishOptions,
    videoDurations: Record<string, number>,
  ) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || slotIds.some((slotId) => !mongoose.Types.ObjectId.isValid(slotId))) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const uniqueSlotIds = [...new Set(slotIds)];
    if (uniqueSlotIds.length === 0 || uniqueSlotIds.length > 100) {
      throw new Error("Chỉ có thể duyệt từ 1 đến 100 video TikTok mỗi lần.");
    }
    const slots = await MarketingCampaignSlotModel.find({
      _id: { $in: uniqueSlotIds },
      campaignId,
      companyCode,
      platform: "TikTok",
    });
    if (slots.length !== uniqueSlotIds.length) {
      throw new Error("Một hoặc nhiều slot TikTok không tồn tại hoặc không thuộc chiến dịch này.");
    }
    const allowedStatuses = ["pending_approval", "needs_attention", "failed"];
    const unavailableSlot = slots.find((slot) => !allowedStatuses.includes(slot.status));
    if (unavailableSlot) {
      throw new Error(`Slot ${unavailableSlot._id} không thể được duyệt ở trạng thái này: ${unavailableSlot.status}`);
    }

    const contentIds = slots.flatMap((slot) => slot.marketingContentId ? [slot.marketingContentId] : []);
    const contents = await MarketingContentModel.find({
      _id: { $in: contentIds },
      companyCode,
    }).select("_id bodyText");
    const contentById = new Map(contents.map((content) => [String(content._id), content]));
    const optionsBySlot = slots.map((slot) => {
      const content = slot.marketingContentId ? contentById.get(String(slot.marketingContentId)) : undefined;
      if (!content) throw new Error(`Slot ${slot._id} chưa có nội dung TikTok để duyệt.`);
      const options: TikTokCampaignPublishOptions = {
        ...tiktokPublishOptions,
        caption: String(slot.customBodyText || content.bodyText || "").trim(),
        videoDurationSeconds: Number(videoDurations[String(slot._id)]),
      };
      validateTikTokCampaignPublishOptions(options);
      return { slot, options };
    });

    const approvedAt = new Date();
    await Promise.all(optionsBySlot.map(async ({ slot, options }) => {
      const approved = await MarketingCampaignSlotModel.findOneAndUpdate(
        { _id: slot._id, campaignId, companyCode, status: slot.status, updatedAt: slot.updatedAt, $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: approvedAt } }] },
        {
          $set: { status: "ready_to_publish", tiktokPublishOptions: options, approvedBy, approvedAt },
          $push: { transitions: { from: slot.status, to: "ready_to_publish", reason: `Batch approved manually by ${approvedBy}`, at: approvedAt } },
        }
      );
      if (!approved) throw Object.assign(new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi duyệt."), { statusCode: 409 });
    }));
    return { approvedCount: optionsBySlot.length };
  },

  async publishFacebookContent(companyCode: string, contentId: string, approvedBy: string, requestedPageId?: string): Promise<{ status: "published" | "processing"; postId?: string; postUrl?: string }> {
    const content = await MarketingContentModel.findOne({ _id: contentId, companyCode });
    const slot = content?.campaignSlotId && await MarketingCampaignSlotModel.findOne({ _id: content.campaignSlotId, companyCode, campaignId: content.campaignId, marketingContentId: content._id, platform: "Facebook" });
    if (!content || !slot) throw Object.assign(new Error("Bài đăng không khớp với slot Facebook của Campaign."), { statusCode: 403 });
    if (slot.status === "published" || content.status === "published") {
      const postId = slot.publishedPostId || content.facebookPostId;
      if (!postId) throw Object.assign(new Error("Chưa có mã bài đăng xác nhận từ Facebook."), { statusCode: 409 });
      return { status: "published", postId, postUrl: slot.publishedUrl || content.postUrl };
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: slot.campaignId, companyCode, status: "active" });
    if (!campaign) throw Object.assign(new Error("Chiến dịch không ở trạng thái đang chạy."), { statusCode: 409 });
    if (slot.status === "publishing") return { status: "processing" };
    if (slot.lockExpiresAt && slot.lockExpiresAt > new Date()) throw Object.assign(new Error("Slot đang xử lý media. Vui lòng thử lại sau."), { statusCode: 409 });
    if (requestedPageId) await resolveFacebookCredentials({ companyCode, createdBy: campaign.createdBy, integrationId: slot.integrationId, expectedPageId: requestedPageId });
    await assertCampaignMediaReady({ campaign, slot, content });
    await this.publishNowSlot(companyCode, String(slot.campaignId), String(slot._id), approvedBy);
    const current = await MarketingContentModel.findOne({ _id: content._id, companyCode }).lean();
    return current?.status === "published" && current.facebookPostId
      ? { status: "published", postId: current.facebookPostId, postUrl: current.postUrl }
      : { status: "processing" };
  },

  async publishNowSlot(companyCode: string, campaignId: string, slotId: string, approvedBy: string, tiktokPublishOptions?: TikTokCampaignPublishOptions) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    if (!await MarketingCampaignModel.exists({ _id: campaignId, companyCode, status: "active" })) {
      throw Object.assign(new Error("Chiến dịch không ở trạng thái đang chạy."), { statusCode: 409 });
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
    if (slot.lockExpiresAt && slot.lockExpiresAt > new Date()) throw Object.assign(new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi đăng."), { statusCode: 409 });
    const allowedStatuses = ["pending_approval", "ready_to_publish", "needs_attention", "failed"];
    if (!allowedStatuses.includes(slot.status)) {
      throw new Error(`Slot không thể đăng ngay ở trạng thái này: ${slot.status}`);
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode, status: "active" });
    const content = slot.marketingContentId && await MarketingContentModel.findOne({
      _id: slot.marketingContentId, companyCode, campaignId, campaignSlotId: slot._id,
    });
    if (!campaign || !content) throw new Error("Không tìm thấy nội dung bài đăng của slot chiến dịch.");
    await assertCampaignMediaReady({ campaign, slot, content });
    if (slot.platform === "TikTok") {
      validateTikTokCampaignPublishOptions(tiktokPublishOptions);
      slot.tiktokPublishOptions = tiktokPublishOptions;
    }

    const lockId = randomUUID();
    const now = new Date();
    const claimed = await MarketingCampaignSlotModel.findOneAndUpdate(
      { _id: slot._id, campaignId, companyCode, status: slot.status, updatedAt: slot.updatedAt, $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
      {
        $set: { status: "publishing", scheduledAt: now, approvedBy, approvedAt: now, lockId, lockedAt: now, lockExpiresAt: new Date(now.getTime() + 20 * 60_000), ...(slot.platform === "TikTok" ? { tiktokPublishOptions } : {}) },
        $push: { transitions: { from: slot.status, to: "publishing", reason: `Publish Now requested by ${approvedBy}`, at: now } },
      },
      { new: true }
    );
    if (!claimed) throw Object.assign(new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi đăng."), { statusCode: 409 });

    CampaignOrchestratorService.orchestratePublish(String(slot._id), lockId).catch((err) => {
      console.error(`[PublishNow] Error publishing slot ${slot._id}:`, err);
    });

    return claimed;
  },

  async updateSlotContent(
    companyCode: string,
    campaignId: string,
    slotId: string,
    updates: {
      title?: string;
      bodyText?: string;
      outline?: string;
      mediaPrompt?: string;
    }
  ) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    return withCampaignSlotEdit({ companyCode, campaignId, slotId, statuses: ["pending_approval", "needs_attention", "failed"] }, async (slot, session) => {
      if (!slot.marketingContentId) throw new Error("Không tìm thấy nội dung bài viết liên kết với slot này.");
      if (slot.platform === "TikTok" && updates.bodyText !== undefined && updates.bodyText.length > 2200) throw new Error("Caption TikTok không được vượt quá 2.200 ký tự.");
      const content = await MarketingContentModel.findOneAndUpdate(
        { _id: slot.marketingContentId, campaignSlotId: slot._id, campaignId, companyCode },
        { $set: updates }, { new: true, session },
      );
      if (!content) throw new Error("Không tìm thấy nội dung bài viết.");
      await syncCampaignSheetFields(companyCode, campaignId, slotId, updates, session);
      const previousStatus = slot.status;
      const changed = await MarketingCampaignSlotModel.updateOne(
        { _id: slot._id, companyCode, campaignId, lockId: slot.lockId },
        { $set: { status: "pending_approval" }, $unset: { lastError: 1, approvedBy: 1, approvedAt: 1, tiktokPublishOptions: 1 },
          $push: { transitions: { from: previousStatus, to: "pending_approval", reason: "Content updated by internal user; approval required.", at: new Date() } } },
        { session },
      );
      if (!changed.matchedCount) throw Object.assign(new Error("Slot đã thay đổi. Hãy tải lại trước khi lưu."), { statusCode: 409 });
      return content;
    });
  },

  async replaceSlotImage(companyCode: string, campaignId: string, slotId: string, imageUrl: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
    const allowedStatuses = ["pending_approval", "needs_attention", "failed"];
    if (!allowedStatuses.includes(slot.status)) {
      throw new Error("Chỉ có thể thay ảnh khi bài viết đang chờ duyệt, cần kiểm tra hoặc lỗi.");
    }
    if (!slot.marketingContentId) {
      throw new Error("Không tìm thấy nội dung bài viết liên kết với slot này.");
    }

    const content = await MarketingContentModel.findOne({ _id: slot.marketingContentId, companyCode, campaignSlotId: slot._id });
    if (!content) throw new Error("Không tìm thấy nội dung bài viết.");
    await syncUploadedSlotMedia({ companyCode, campaignId, slotId, contentId: String(content._id), mediaType: "image", urls: [imageUrl] });
    return MarketingContentModel.findOne({ _id: content._id, companyCode });
  },

  async generateShareLink(companyCode: string, campaignId: string, slotId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
    assertTikTokPublicApprovalDisabled(slot.platform);
    
    // Sign token valid for 30 days
    const token = jwt.sign(
      { slotId, campaignId, companyCode },
      getMarketingApprovalSecret(),
      { expiresIn: "30d" }
    );
    
    let baseUrl = getMarketingAppUrl();
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    return { shareLink: `${baseUrl}/approve-post?token=${token}` };
  },

  async getPublicSlotDetail(token: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { slotId: string; campaignId: string; companyCode: string };

      if (!decoded.slotId || !decoded.campaignId || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      const slot = await MarketingCampaignSlotModel.findOne({
        _id: decoded.slotId,
        campaignId: decoded.campaignId,
        companyCode: decoded.companyCode,
      }).populate("selectedCandidateId").lean();
      if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");

      const campaign = await MarketingCampaignModel.findOne({
        _id: decoded.campaignId,
        companyCode: decoded.companyCode,
      });

      let content = null;
      if (slot.marketingContentId) {
        content = await MarketingContentModel.findOne({
          _id: slot.marketingContentId,
          companyCode: decoded.companyCode,
        }).lean();
      }

      const candidateDoc = slot.selectedCandidateId as unknown as {
        _id: mongoose.Types.ObjectId;
        variant: string;
      } | null;

      const transformedSlot = {
        ...slot,
        variant: candidateDoc?.variant || null
      };

      return { slot: transformedSlot, content, campaign };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Token không hợp lệ hoặc đã hết hạn.");
    }
  },

  async executePublicSlotAction(token: string, action: "approve" | "reject", reason?: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { slotId: string; campaignId: string; companyCode: string };

      const publicScope = await publicCampaignSlotScope(decoded);
      const slot = await MarketingCampaignSlotModel.findOne(publicScope);
      if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
      rememberPublicApprovalState(slot);
      assertTikTokPublicApprovalDisabled(slot.platform);

      if (slot.status !== "pending_approval") {
        throw new Error(`Bài đăng này đã được xử lý (Trạng thái hiện tại: ${slot.status}).`);
      }

      if (action === "approve") {
        slot.status = "ready_to_publish";
        slot.approvedBy = "External Reviewer";
        slot.approvedAt = new Date();
        slot.transitions.push({
          from: "pending_approval",
          to: "ready_to_publish",
          reason: "Approved by external reviewer via public link",
          at: new Date(),
        });
      } else if (action === "reject") {
        slot.status = "needs_attention";
        slot.lastError = {
          type: "validation",
          message: reason || "Từ chối bởi người duyệt bên ngoài.",
          occurredAt: new Date(),
        };
        slot.transitions.push({
          from: "pending_approval",
          to: "needs_attention",
          reason: `Rejected by external reviewer: ${reason || "Không có lý do."}`,
          at: new Date(),
        });
      } else {
        throw new Error("Thao tác không hợp lệ.");
      }

      return await savePublicSlotDecision(slot, publicScope);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Thao tác phê duyệt thất bại.");
    }
  },

  async rejectSlot(companyCode: string, campaignId: string, slotId: string, reason: string, rejectedBy: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
    if (slot.status !== "pending_approval") {
      throw new Error(`Slot không thể được từ chối ở trạng thái này: ${slot.status}`);
    }

    const now = new Date();
    const rejected = await MarketingCampaignSlotModel.findOneAndUpdate(
      { _id: slot._id, campaignId, companyCode, status: "pending_approval", updatedAt: slot.updatedAt,
        $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
      { $set: { status: "needs_attention", lastError: { type: "validation", message: reason, occurredAt: now } },
        $unset: { approvedBy: 1, approvedAt: 1, tiktokPublishOptions: 1 },
        $push: { transitions: { from: "pending_approval", to: "needs_attention", reason: `Rejected by ${rejectedBy}: ${reason}`, at: now } } },
      { returnDocument: "after" },
    );
    if (!rejected) throw Object.assign(new Error("Slot đã thay đổi hoặc đang được xử lý. Hãy tải lại trước khi từ chối."), { statusCode: 409 });
    return rejected;
  },

  async publishNowSlotDirect(companyCode: string, campaignId: string, slotId: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      throw new Error("ID chiến dịch hoặc slot không hợp lệ.");
    }
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, campaignId, companyCode });
    if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");

    if (slot.status === "published") {
      throw new Error("Slot này đã được đăng trước đó.");
    }

    if (slot.status !== "ready_to_publish") {
      throw new Error(`Slot chưa sẵn sàng để xuất bản (Trạng thái hiện tại: ${slot.status}). Vui lòng phê duyệt trước.`);
    }

    const { randomUUID } = await import("crypto");
    const lockId = randomUUID();
    const now = new Date();
    const LEASE_MS = 20 * 60000;

    const claimed = await MarketingCampaignSlotModel.findOneAndUpdate(
      {
        _id: slotId,
        campaignId,
        companyCode,
        status: "ready_to_publish",
        $or: [
          { lockExpiresAt: { $exists: false } },
          { lockExpiresAt: null },
          { lockExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "publishing",
          lockId,
          lockedAt: now,
          lockExpiresAt: new Date(now.getTime() + LEASE_MS),
        },
        $push: {
          transitions: {
            from: "ready_to_publish",
            to: "publishing",
            reason: "Immediate publish requested by user",
            at: now,
          },
        },
      },
      { new: true }
    );

    if (!claimed) {
      throw new Error("Không thể chiếm quyền xuất bản slot. Slot có thể đang được xử lý bởi một tiến trình khác.");
    }

    const { CampaignOrchestratorService } = await import("./agents/campaign-orchestrator.service.ts");
    await CampaignOrchestratorService.orchestratePublish(slotId, lockId);

    const updatedSlot = await MarketingCampaignSlotModel.findById(slotId).populate("marketingContentId").lean();
    return updatedSlot;
  },

  async previewDrive(googleDriveFolderUrl: string) {
    if (!googleDriveFolderUrl) {
      throw new Error("Vui lòng cung cấp đường dẫn thư mục Google Drive.");
    }
    const files = await listGoogleDriveFolderFiles(googleDriveFolderUrl);
    if (!files.length) {
      return [];
    }
    return files
      .filter((file) => {
        const name = file.name.toLowerCase();
        return /\.(jpg|jpeg|png|webp|gif|heic|mp4|mov|avi|webm)$/.test(name);
      })
      .map((file) => {
        const name = file.name.toLowerCase();
        const isVideo = /\.(mp4|mov|avi|webm)$/.test(name);
        const directUrl = getGoogleDriveDirectLink(file.id, isVideo ? "video" : "image");
        return {
          id: file.id,
          name: file.name,
          directUrl,
          isVideo,
        };
      });
  },

  async generateDailyShareLink(companyCode: string, campaignId: string, date: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      throw new Error("ID chiến dịch không hợp lệ.");
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode });
    if (!campaign) throw new Error("Không tìm thấy chiến dịch.");

    // Sign token valid for 30 days
    const token = jwt.sign(
      { campaignId, date, companyCode },
      getMarketingApprovalSecret(),
      { expiresIn: "30d" }
    );

    let baseUrl = getMarketingAppUrl();
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }

    return { shareLink: `${baseUrl}/approve-posts-day?token=${token}` };
  },

  async getPublicDailySlotsDetail(token: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; date: string; companyCode: string };

      if (!decoded.campaignId || !decoded.date || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      const campaign = await MarketingCampaignModel.findOne({
        _id: decoded.campaignId,
        companyCode: decoded.companyCode,
      });
      if (!campaign) throw new Error("Không tìm thấy chiến dịch.");

      // Calculate start and end of date in campaign's timezone
      const startOfDay = zonedLocalTimeToUtc(decoded.date, "00:00", campaign.timezone || "Asia/Ho_Chi_Minh");
      const endOfDay = zonedLocalTimeToUtc(nextCalendarDate(decoded.date), "00:00", campaign.timezone || "Asia/Ho_Chi_Minh");

      const slots = await MarketingCampaignSlotModel.find({
        campaignId: decoded.campaignId,
        companyCode: decoded.companyCode,
        scheduledAt: { $gte: startOfDay, $lt: endOfDay }
      }).populate("selectedCandidateId").lean();

      const slotsWithContent = await Promise.all(slots.map(async (slot) => {
        let content = null;
        if (slot.marketingContentId) {
          content = await MarketingContentModel.findOne({
            _id: slot.marketingContentId,
            companyCode: decoded.companyCode,
          }).lean();
        }
        const candidateDoc = slot.selectedCandidateId as unknown as {
          _id: mongoose.Types.ObjectId;
          variant: string;
        } | null;
        return {
          ...slot,
          content,
          variant: candidateDoc?.variant || null
        };
      }));

      return { campaign, slots: slotsWithContent, date: decoded.date };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Token không hợp lệ hoặc đã hết hạn.");
    }
  },

  async executePublicDailySlotAction(token: string, slotId: string, action: "approve" | "reject", reason?: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; date: string; companyCode: string };

      if (!decoded.campaignId || !decoded.date || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new Error("ID slot không hợp lệ.");
      }

      const publicScope = await publicCampaignSlotScope(decoded);
      const slot = await MarketingCampaignSlotModel.findOne({ ...publicScope, _id: slotId });
      if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
      rememberPublicApprovalState(slot);
      assertTikTokPublicApprovalDisabled(slot.platform);

      if (slot.status !== "pending_approval") {
        throw new Error(`Bài đăng này đã được xử lý (Trạng thái hiện tại: ${slot.status}).`);
      }

      if (action === "approve") {
        slot.status = "ready_to_publish";
        slot.approvedBy = "External Reviewer (Daily)";
        slot.approvedAt = new Date();
        slot.transitions.push({
          from: "pending_approval",
          to: "ready_to_publish",
          reason: "Approved by external reviewer via public daily link",
          at: new Date(),
        });
      } else if (action === "reject") {
        slot.status = "needs_attention";
        slot.lastError = {
          type: "validation",
          message: reason || "Từ chối bởi người duyệt bên ngoài (Daily).",
          occurredAt: new Date(),
        };
        slot.transitions.push({
          from: "pending_approval",
          to: "needs_attention",
          reason: `Rejected by external reviewer via daily link: ${reason || "Không có lý do."}`,
          at: new Date(),
        });
      } else {
        throw new Error("Thao tác không hợp lệ.");
      }

      return await savePublicSlotDecision(slot, publicScope);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Thao tác phê duyệt thất bại.");
    }
  },

  async updatePublicDailySlotContent(token: string, slotId: string, updates: { title?: string; bodyText?: string }) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; date: string; companyCode: string };

      if (!decoded.campaignId || !decoded.date || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new Error("ID slot không hợp lệ.");
      }

      const publicScope = await publicCampaignSlotScope(decoded);
      const slot = await MarketingCampaignSlotModel.findOne({ ...publicScope, _id: slotId });
      if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
      assertTikTokPublicApprovalDisabled(slot.platform);

      if (!["pending_approval", "needs_attention", "failed"].includes(slot.status)) {
        throw new Error(`Không thể chỉnh sửa nội dung ở trạng thái hiện tại (${slot.status}).`);
      }

      for (const key of ["title", "bodyText"] as const) {
        if (updates[key] !== undefined && (typeof updates[key] !== "string" || !updates[key]!.trim())) {
          throw new Error("Tiêu đề và nội dung bài viết không được để trống.");
        }
      }
      const lockId = randomUUID();
      const now = new Date();
      const claimed = await MarketingCampaignSlotModel.findOneAndUpdate(
        { ...publicScope, _id: slotId, status: slot.status, $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
        { $set: { lockId, lockedAt: now, lockExpiresAt: new Date(now.getTime() + 5 * 60_000) } },
        { returnDocument: "after" },
      );
      if (!claimed) throw new Error("Bài đăng đang được xử lý. Vui lòng tải lại trước khi sửa.");
      try {
        let content = claimed.marketingContentId
          ? await MarketingContentModel.findOne({ _id: claimed.marketingContentId, companyCode: decoded.companyCode, campaignId: decoded.campaignId })
          : await MarketingContentModel.findOne({ campaignSlotId: claimed._id, companyCode: decoded.companyCode });
        if (!content) {
          if (!updates.title?.trim() || !updates.bodyText?.trim()) {
            throw new Error("Vui lòng nhập tiêu đề và nội dung để tạo bài viết.");
          }
          content = await MarketingContentModel.create({
            companyCode: decoded.companyCode, campaignId: decoded.campaignId, campaignSlotId: claimed._id,
            channel: claimed.platform, contentType: "Social Post", title: updates.title, bodyText: updates.bodyText,
            ...(claimed.mediaType === "text" ? {} : { mediaType: claimed.mediaType }), mediaUrls: [],
          });
        } else {
          if (content.campaignSlotId && String(content.campaignSlotId) !== String(claimed._id)) {
            throw new Error("Bài đăng không khớp với slot chiến dịch.");
          }
          if (updates.title !== undefined) content.title = updates.title;
          if (updates.bodyText !== undefined) content.bodyText = updates.bodyText;
          content.campaignSlotId = claimed._id as mongoose.Types.ObjectId;
          await content.save();
        }
        const updated = await MarketingCampaignSlotModel.findOneAndUpdate(
          { ...publicScope, _id: claimed._id, lockId, status: claimed.status },
          { $set: { marketingContentId: content._id }, $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 } },
          { returnDocument: "after" },
        );
        if (!updated) throw new Error("Bài đăng đã thay đổi. Vui lòng tải lại.");
        return { slot: updated, content };
      } finally {
        await MarketingCampaignSlotModel.updateOne(
          { _id: claimed._id, companyCode: decoded.companyCode, lockId },
          { $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 } },
        );
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Cập nhật nội dung thất bại.");
    }
  },

  async generateMonthlyShareLink(companyCode: string, campaignId: string, startDate: string, endDate: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      throw new Error("ID chiến dịch không hợp lệ.");
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode });
    if (!campaign) throw new Error("Không tìm thấy chiến dịch.");

    // Sign token valid for 30 days
    const token = jwt.sign(
      { campaignId, startDate, endDate, companyCode },
      getMarketingApprovalSecret(),
      { expiresIn: "30d" }
    );

    let baseUrl = getMarketingAppUrl();
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }

    return { shareLink: `${baseUrl}/approve-posts-month?token=${token}` };
  },

  async getPublicMonthlySlotsDetail(token: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; startDate: string; endDate: string; companyCode: string };

      if (!decoded.campaignId || !decoded.startDate || !decoded.endDate || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      const campaign = await MarketingCampaignModel.findOne({
        _id: decoded.campaignId,
        companyCode: decoded.companyCode,
      });
      if (!campaign) throw new Error("Không tìm thấy chiến dịch.");

      // Calculate start and end boundary in campaign's timezone
      const startDateTime = zonedLocalTimeToUtc(decoded.startDate, "00:00", campaign.timezone || "Asia/Ho_Chi_Minh");
      const endDateTime = zonedLocalTimeToUtc(nextCalendarDate(decoded.endDate), "00:00", campaign.timezone || "Asia/Ho_Chi_Minh");

      const slots = await MarketingCampaignSlotModel.find({
        campaignId: decoded.campaignId,
        companyCode: decoded.companyCode,
        scheduledAt: { $gte: startDateTime, $lt: endDateTime }
      }).populate("selectedCandidateId").lean();

      const slotsWithContent = await Promise.all(slots.map(async (slot) => {
        let content = null;
        if (slot.marketingContentId) {
          content = await MarketingContentModel.findOne({
            _id: slot.marketingContentId,
            companyCode: decoded.companyCode,
          }).lean();
        }
        const candidateDoc = slot.selectedCandidateId as unknown as {
          _id: mongoose.Types.ObjectId;
          variant: string;
        } | null;
        return {
          ...slot,
          content,
          variant: candidateDoc?.variant || null
        };
      }));

      return { campaign, slots: slotsWithContent, startDate: decoded.startDate, endDate: decoded.endDate };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Token không hợp lệ hoặc đã hết hạn.");
    }
  },

  async executePublicMonthlySlotAction(token: string, slotId: string, action: "approve" | "reject", reason?: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; startDate: string; endDate: string; companyCode: string };

      if (!decoded.campaignId || !decoded.startDate || !decoded.endDate || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new Error("ID slot không hợp lệ.");
      }

      const publicScope = await publicCampaignSlotScope(decoded);
      const slot = await MarketingCampaignSlotModel.findOne({ ...publicScope, _id: slotId });
      if (!slot) throw new Error("Không tìm thấy slot chiến dịch.");
      rememberPublicApprovalState(slot);
      if (slot.status !== "pending_approval") {
        throw new Error(`Bài đăng này đã được xử lý (Trạng thái hiện tại: ${slot.status}).`);
      }

      if (action === "approve") {
        if (slot.platform === "TikTok") {
          if (slot.approvedBy === TIKTOK_MONTHLY_EXTERNAL_REVIEWER) {
            throw new Error("Nội dung TikTok này đã được duyệt, đang chờ chủ tài khoản xác nhận đăng.");
          }
          slot.approvedBy = TIKTOK_MONTHLY_EXTERNAL_REVIEWER;
          slot.approvedAt = new Date();
          slot.transitions.push({
            from: "pending_approval",
            to: "pending_approval",
            reason: "TikTok content approved by external reviewer via monthly link; awaiting creator privacy and consent confirmation.",
            at: new Date(),
          });
          const approved = await savePublicSlotDecision(slot, publicScope);
          return { slot: approved, reviewState: "awaiting_tiktok_creator_confirmation" };
        }
        slot.status = "ready_to_publish";
        slot.approvedBy = "External Reviewer (Monthly)";
        slot.approvedAt = new Date();
        slot.transitions.push({
          from: "pending_approval",
          to: "ready_to_publish",
          reason: "Approved by external reviewer via public monthly link",
          at: new Date(),
        });
      } else if (action === "reject") {
        if (!reason || !reason.trim()) {
          throw new Error("Vui lòng nhập lý do từ chối bài viết.");
        }
        slot.status = "needs_attention";
        slot.lastError = {
          type: "validation",
          message: reason.trim(),
          occurredAt: new Date(),
        };
        slot.transitions.push({
          from: "pending_approval",
          to: "needs_attention",
          reason: `Rejected by external reviewer via monthly link: ${reason.trim()}`,
          at: new Date(),
        });
      } else {
        throw new Error("Thao tác không hợp lệ.");
      }

      const updated = await savePublicSlotDecision(slot, publicScope);
      return { slot: updated, reviewState: action === "approve" ? "approved" : "rejected" };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Thao tác phê duyệt thất bại.");
    }
  },

  async executePublicMonthlyBulkAction(token: string, slotIds: string[], action: "approve" | "reject", reason?: string) {
    try {
      const decoded = jwt.verify(
        token,
        getMarketingApprovalSecret()
      ) as { campaignId: string; startDate: string; endDate: string; companyCode: string };

      if (!decoded.campaignId || !decoded.startDate || !decoded.endDate || !decoded.companyCode) {
        throw new Error("Token không chứa đầy đủ thông tin.");
      }

      if (!Array.isArray(slotIds) || slotIds.length === 0) {
        throw new Error("Danh sách slot không hợp lệ.");
      }

      if (action === "reject" && (!reason || !reason.trim())) {
        throw new Error("Vui lòng nhập lý do từ chối hàng loạt bài viết.");
      }

      const publicScope = await publicCampaignSlotScope(decoded);
      const slots = await MarketingCampaignSlotModel.find({
        ...publicScope,
        _id: { $in: slotIds },
      });

      let processed = 0;
      let skipped = 0;

      for (const slot of slots) {
        if (slot.status !== "pending_approval" || (slot.lockExpiresAt && slot.lockExpiresAt > new Date())) {
          skipped++;
          continue;
        }
        rememberPublicApprovalState(slot);

        if (action === "approve") {
          if (slot.platform === "TikTok") {
            if (slot.approvedBy === TIKTOK_MONTHLY_EXTERNAL_REVIEWER) {
              skipped++;
              continue;
            }
            slot.approvedBy = TIKTOK_MONTHLY_EXTERNAL_REVIEWER;
            slot.approvedAt = new Date();
            slot.transitions.push({
              from: "pending_approval",
              to: "pending_approval",
              reason: "TikTok content approved by external reviewer via monthly bulk action; awaiting creator privacy and consent confirmation.",
              at: new Date(),
            });
            try { await savePublicSlotDecision(slot, publicScope); processed++; }
            catch (error) { if ((error as { statusCode?: number }).statusCode !== 409) throw error; skipped++; }
            continue;
          }
          slot.status = "ready_to_publish";
          slot.approvedBy = "External Reviewer (Monthly Bulk)";
          slot.approvedAt = new Date();
          slot.transitions.push({
            from: "pending_approval",
            to: "ready_to_publish",
            reason: "Approved by external reviewer via monthly bulk action",
            at: new Date(),
          });
        } else if (action === "reject") {
          slot.status = "needs_attention";
          slot.lastError = {
            type: "validation",
            message: reason!.trim(),
            occurredAt: new Date(),
          };
          slot.transitions.push({
            from: "pending_approval",
            to: "needs_attention",
            reason: `Rejected by external reviewer via monthly bulk action: ${reason!.trim()}`,
            at: new Date(),
          });
        }
        try { await savePublicSlotDecision(slot, publicScope); processed++; }
        catch (error) { if ((error as { statusCode?: number }).statusCode !== 409) throw error; skipped++; }
      }

      return { processed, skipped };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Thao tác hàng loạt thất bại.");
    }
  },

  async batchPrepareMonth(companyCode: string, campaignId: string, startDate: string, endDate: string) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      throw new Error("ID chiến dịch không hợp lệ.");
    }
    const campaign = await MarketingCampaignModel.findOne({ _id: campaignId, companyCode });
    if (!campaign) throw new Error("Không tìm thấy chiến dịch.");

    // Calculate start and end boundary in campaign's timezone
    const startDateTime = zonedLocalTimeToUtc(startDate, "00:00", campaign.timezone || "Asia/Ho_Chi_Minh");
    const endDateTime = zonedLocalTimeToUtc(endDate, "23:59", campaign.timezone || "Asia/Ho_Chi_Minh");

    const slots = await MarketingCampaignSlotModel.find({
      campaignId,
      companyCode,
      scheduledAt: { $gte: startDateTime, $lte: endDateTime },
      status: { $in: ["planned", "retrying", "failed", "needs_attention"] }
    });

    let enqueued = 0;
    const now = new Date();

    for (const slot of slots) {
      slot.prepareAt = now;
      slot.status = "planned";
      slot.attemptCount = 0;
      slot.lockId = null;
      slot.lockedAt = null;
      slot.lockExpiresAt = null;
      slot.lastError = undefined;
      slot.transitions.push({
        from: slot.status,
        to: "planned",
        reason: "Reset slot for batch generation by marketer",
        at: now,
      });
      await slot.save();
      enqueued++;
    }

    try {
      await scanAndEnqueueDueSlots({
        campaignId,
        limit: Math.min(slots.length, 100),
      });
    } catch (error) {
      console.warn("[Batch Prepare] Unable to enqueue the first bounded batch; scheduler will retry.", error);
    }

    return { enqueued, skipped: 0 };
  }
};
