import { createHash } from "crypto";
import mongoose from "mongoose";
import { getAiUsageContext, withAiUsage } from "../../../shared/service/ai-subscription.service";
import { guardCampaignSlot } from "../../worker-access";
import { createCampaignPrepareLease, isPrepareLeaseLost } from "../campaign-prepare-lease";
import { MarketingCampaignModel } from "../../model/marketing-campaign.model.ts";
import { MarketingCampaignSlotModel } from "../../model/marketing-campaign-slot.model.ts";
import { MarketingContentModel } from "../../model/marketing-content.model.ts";
import { CampaignAssetOrderModel } from "../../model/campaign-asset-order.model.ts";
import { ResearcherAgentService } from "../../../shared/service/agents/researcher-agent.service.ts";
import { CandidateSelectionService as CopywriterAgentService } from "../candidate-selection.service";
import { MediaCreatorAgentService } from "../../../shared/service/agents/media-creator-agent.service.ts";
import { QcAgentService } from "../../../shared/service/agents/qc-agent.service.ts";
import { PublisherAgentService } from "../../../shared/service/agents/publisher-agent.service.ts";
import { releaseWithFailure, syncCampaignContentFailure, syncCampaignContentReady } from "./campaign-utils";
import { cloudinaryService } from "../../../shared/service/cloudinary.service.ts";
import { API_COSTS, walletService } from "../../../shared/service/wallet.service.ts";
import { VisualAnalystAgentService } from "../../../shared/service/agents/visual-analyst-agent.service.ts";
import { approvalNotifierService } from "../approval-notifier.service.ts";
import { applyCampaignVideoCaption } from "./campaign-caption.service.ts";
import { broadcastEvent } from "../../../shared/socket";
import { campaignContentSheetService } from "../campaign-content-sheet.service.ts";
import { aiKnowledgeService } from "../../../knowledge/service/ai-knowledge.service.ts";
import { SocialIntegrationModel } from "../../../shared/model/social-integration.model.ts";
import {
  extractKnowledgeContactDetails,
  formatKnowledgeContactContext,
  mergePageContactDetails,
} from "./campaign-contact-footer";

function emitSlotUpdate(slot: { _id: unknown; campaignId: unknown; companyCode: string; status: string }, extra?: Record<string, unknown>) {
  try {
    broadcastEvent("campaign:slot-update", {
      slotId: String(slot._id),
      campaignId: String(slot.campaignId),
      companyCode: slot.companyCode,
      status: slot.status,
      updatedAt: new Date().toISOString(),
      ...extra,
    });
  } catch (e) {
    console.warn("[Orchestrator] Socket broadcast failed:", e);
  }
}

function buildUserFacingProductionBrief(input: {
  outline?: unknown;
  bodyText?: unknown;
  topicBrief?: unknown;
}) {
  const vietnameseBrief = String(input.outline || input.bodyText || input.topicBrief || "").trim();
  return {
    shootingContent: vietnameseBrief.slice(0, 1000),
    productionRequirements: vietnameseBrief.slice(0, 2000),
    visualBrief: vietnameseBrief.slice(0, 1000),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await handler(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function ingestRealMedia(
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  campaign: InstanceType<typeof MarketingCampaignModel>,
  save = async () => { await slot.save(); },
): Promise<string[]> {
  const sourceUrls = (slot.realImageDirectUrls || []).filter(Boolean);
  if (sourceUrls.length === 0) {
    throw new Error("Slot ảnh thật không có media Google Drive để xử lý.");
  }

  const fingerprint = createHash("sha256").update(JSON.stringify(sourceUrls)).digest("hex");
  if (
    slot.mediaIngestionFingerprint === fingerprint &&
    slot.ingestedMedia?.length === sourceUrls.length
  ) {
    return slot.ingestedMedia.map((item) => item.url);
  }

  const uploadedAt = new Date();
  const ingestedMedia = await mapWithConcurrency(sourceUrls, 3, async (sourceUrl) => ({
    sourceUrl,
    url: await cloudinaryService.uploadMedia(sourceUrl, `campaign_${campaign._id}`),
    uploadedAt,
  }));

  slot.mediaIngestionFingerprint = fingerprint;
  slot.ingestedMedia = ingestedMedia;
  slot.transitions.push({
    from: slot.status,
    to: slot.status,
    reason: `Đã ingest ${ingestedMedia.length} media thật lên Cloudinary để dùng chung cho Vision và xuất bản.`,
    at: new Date(),
  });
  await save();
  return ingestedMedia.map((item) => item.url);
}

function resolveSlotMediaSource(
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  campaign: InstanceType<typeof MarketingCampaignModel>
) {
  if (slot.mediaType === "video" || slot.mediaType === "human-video") {
    return slot.mediaSource && slot.mediaSource !== "ai" && slot.mediaSource !== "none" ? slot.mediaSource : "upload";
  }
  if (slot.mediaSource) return slot.mediaSource;
  return campaign.imageMode === "ai" ? "ai" : "drive";
}

async function billCampaignOperation(
  campaign: InstanceType<typeof MarketingCampaignModel>,
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  operation: string,
  amount: number,
  description: string
): Promise<void> {
  const result = await walletService.deductBalance(
    campaign.createdBy,
    amount,
    description,
    `${campaign._id}:${slot._id}:${operation}`
  );
  if (result?.charged) {
    await MarketingCampaignModel.updateOne(
      { _id: campaign._id, companyCode: campaign.companyCode },
      { $inc: { "statistics.actualCost": amount } }
    );
  }
}

async function getResearchContext(
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  campaign: InstanceType<typeof MarketingCampaignModel>,
  save: () => Promise<void>,
): Promise<string> {
  const fingerprint = ResearcherAgentService.fingerprint(slot, campaign);
  let analysis = slot.researchAnalysis;

  if (!analysis || analysis.fingerprint !== fingerprint) {
    await walletService.checkBalance(campaign.createdBy, API_COSTS.CAMPAIGN_RESEARCH);
    analysis = await ResearcherAgentService.research(slot, campaign);
    slot.researchAnalysis = analysis;
    slot.transitions.push({
      from: slot.status,
      to: slot.status,
      reason: `Researcher Agent đã hoàn tất nghiên cứu web cho slot bằng ${analysis.model}.`,
      at: new Date(),
    });
    await save();
  }

  if (!analysis.billedAt) {
    await billCampaignOperation(
      campaign,
      slot,
      `research:${analysis.fingerprint}`,
      analysis.cost,
      `Researcher Agent for campaign slot ${slot._id}`
    );
    analysis.billedAt = new Date();
    slot.researchAnalysis = analysis;
    await save();
  }

  const integration = slot.integrationId
    ? await SocialIntegrationModel.findById(slot.integrationId).select("platform username").lean()
    : null;
  const pageId = slot.platform === "Facebook"
    ? String(integration?.username || "") || undefined
    : undefined;
  const knowledgeScope = {
    companyCode: slot.companyCode,
    channel: slot.platform === "TikTok" ? "tiktok" as const : "facebook" as const,
    purpose: "marketing" as const,
    pageId,
  };
  const [knowledge, contactKnowledge] = await Promise.all([
    aiKnowledgeService.searchRelevantContext({
      ...knowledgeScope,
      topK: 8,
      query: [
        campaign.title,
        campaign.sourceBrief,
        slot.pillar,
        slot.objective,
        slot.topicBrief,
        "thông tin doanh nghiệp thương hiệu sản phẩm dịch vụ",
      ].filter(Boolean).join(" "),
    }),
    aiKnowledgeService.searchRelevantContext({
      ...knowledgeScope,
      topK: 12,
      query: "hotline sđt sdt số điện thoại điện thoại liên hệ địa chỉ đ/c dc trụ sở văn phòng website trang web",
    }),
  ]);

  const pageContactText = contactKnowledge.items
    .filter((item) => (
      pageId
      && item.pageScope === "selected"
      && item.pageIds.includes(pageId)
    ))
    .map((item) => item.text)
    .join("\n");
  const sharedContactText = contactKnowledge.items
    .filter((item) => item.pageScope !== "selected")
    .map((item) => item.text)
    .join("\n");
  const effectiveContacts = mergePageContactDetails(
    extractKnowledgeContactDetails(pageContactText),
    extractKnowledgeContactDetails(sharedContactText)
  );
  const contactContext = formatKnowledgeContactContext(effectiveContacts);

  const knowledgeContext = knowledge.contextText
    ? `\n\nKHO TRI THỨC DOANH NGHIỆP (nguồn sự thật, đúng công ty/kênh/Page):\n${knowledge.contextText}`
    : "\n\nKHO TRI THỨC DOANH NGHIỆP: Không tìm thấy dữ liệu phù hợp. Không được tự bịa thông tin.";
  const effectiveContactContext = contactContext
    ? `\n\nKHO LIÊN HỆ HIỆU LỰC (bắt buộc đặt ở cuối bài):\n${contactContext}`
    : "\n\nKHO LIÊN HỆ HIỆU LỰC: Không có hotline, địa chỉ hoặc website phù hợp; không thêm footer liên hệ.";

  return `${analysis.context}${knowledgeContext}${effectiveContactContext}`;
}

async function getVisualContext(
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  campaign: InstanceType<typeof MarketingCampaignModel>,
  save: () => Promise<void>,
): Promise<string> {
  const fingerprint = VisualAnalystAgentService.fingerprint(slot, campaign);
  let analysis = slot.visualAnalysis;

  if (!analysis || analysis.fingerprint !== fingerprint) {
    const imageCount = slot.ingestedMedia?.length || slot.realImageDirectUrls?.length || 0;
    const expectedCost = API_COSTS.CAMPAIGN_VISION * Math.ceil(imageCount / 8);
    await walletService.checkBalance(campaign.createdBy, expectedCost);
    analysis = await VisualAnalystAgentService.analyze(slot, campaign);
    slot.visualAnalysis = analysis;
    slot.transitions.push({
      from: slot.status,
      to: slot.status,
      reason: `Vision Agent đã phân tích ${analysis.sourceUrls.length} ảnh thật của slot bằng ${analysis.model}.`,
      at: new Date(),
    });
    await save();
  }

  if (!analysis.billedAt) {
    await billCampaignOperation(
      campaign,
      slot,
      `vision:${analysis.fingerprint}`,
      analysis.cost,
      `Phân tích ảnh thật cho slot chiến dịch ${slot._id} (Vision Analyst Agent)`
    );
    analysis.billedAt = new Date();
    slot.visualAnalysis = analysis;
    await save();
  }

  return VisualAnalystAgentService.formatForCopywriter(analysis);
}

export class CampaignOrchestratorService {
  /**
   * Pipeline 1: Prepare Slot Content (Researcher Agent + Copywriter Agent)
   */
  public static async orchestratePrepare(slotId: string, lockId: string): Promise<void> {
    if (getAiUsageContext()?.slotId !== slotId) {
      const scope = await MarketingCampaignSlotModel.findById(slotId).select("companyCode campaignId").lean();
      if (!scope) return;
      return withAiUsage({ companyCode: scope.companyCode, campaignId: String(scope.campaignId), slotId }, () => this.orchestratePrepare(slotId, lockId));
    }
    if (!await guardCampaignSlot(slotId, lockId)) return;
    const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, lockId, status: "generating" });
    if (!slot) return;

    const campaign = await MarketingCampaignModel.findOne({
      _id: slot.campaignId,
      companyCode: slot.companyCode,
      status: "active",
    });
    if (!campaign) {
      await releaseWithFailure(slotId, lockId, "prepare", new Error("Chiến dịch liên kết không hoạt động hoặc không tồn tại."));
      return;
    }

    const lease = createCampaignPrepareLease(slot, lockId);
    try {
      await lease.assertActive();
      const sheetInput = await campaignContentSheetService.getWorkerInput(
        slot.companyCode,
        String(slot.campaignId),
        String(slot._id)
      );
      const manualBodyText = sheetInput.bodyOverride || slot.customBodyText || "";
      const persistedContent = await MarketingContentModel.findOne({ campaignSlotId: slot._id, companyCode: slot.companyCode }).lean();
      let candidate: {
        _id?: unknown;
        title: string;
        bodyText: string;
        outline?: string;
        mediaPrompt?: string;
        voiceScript?: string;
      };

      if (persistedContent) {
        // Retry resumes the persisted winning content, including user edits.
        // Its candidate linkage must not be replaced by a newly generated winner.
        candidate = {
          _id: slot.selectedCandidateId,
          title: persistedContent.title,
          bodyText: persistedContent.bodyText,
          outline: persistedContent.outline,
          mediaPrompt: persistedContent.mediaPrompt,
          voiceScript: persistedContent.voiceScript,
        };
      } else if (campaign.imageMode === "real") {
        // Step A: Research the slot and analyze only this slot's real media
        slot.status = "researching";
        slot.transitions.push({
          from: "generating",
          to: "researching",
          reason: "Researcher Agent bắt đầu thu thập bối cảnh trước khi phân tích ảnh thật của slot.",
          at: new Date(),
        });
        await lease.save();
        emitSlotUpdate(slot);

        await ingestRealMedia(slot, campaign, lease.save);

        let researchContext = "";
        let visualContext = "";
        if (!manualBodyText) {
          researchContext = await getResearchContext(slot, campaign, lease.save);
          await lease.assertActive();
          visualContext = await getVisualContext(slot, campaign, lease.save);
        }

        slot.status = "writing";
        slot.transitions.push({
          from: "researching",
          to: "writing",
          reason: "Đã kết hợp nghiên cứu slot và phân tích ảnh thật. Copywriter Agent bắt đầu viết nội dung.",
          at: new Date(),
        });
        await lease.save();
        emitSlotUpdate(slot);

        if (manualBodyText) {
          // Use pre-written content
          candidate = {
            title: sheetInput.titleOverride || slot.topicBrief || "Bài đăng chiến dịch",
            bodyText: manualBodyText,
            outline: "Nội dung được người dùng khóa trong Campaign Content Sheet",
            mediaPrompt: "Sử dụng ảnh thật Google Drive",
            voiceScript: manualBodyText,
          };
        } else {
          // Let copywriter write it based on the sheet brief
          candidate = await CopywriterAgentService.write(
            slot,
            campaign,
            `${researchContext}\n\n${visualContext}\n\n${sheetInput.contextText}`.trim(),
            lease.assertActive,
          );
        }
      } else {
        // Step A: Move to "researching" status
        slot.status = "researching";
        slot.transitions.push({
          from: "generating",
          to: "researching",
          reason: "Researcher Agent bắt đầu thu thập bối cảnh và nghiên cứu từ khóa.",
          at: new Date(),
        });
        await lease.save();
        emitSlotUpdate(slot);

        // Run Researcher Agent
        const researchContext = await getResearchContext(slot, campaign, lease.save);

        // Step B: Move to "writing" status
        slot.status = "writing";
        slot.transitions.push({
          from: "researching",
          to: "writing",
          reason: "Copywriter Agent bắt đầu viết bài viết dựa trên kết quả nghiên cứu.",
          at: new Date(),
        });
        await lease.save();
        emitSlotUpdate(slot);

        // Run Copywriter Agent (Single-Variant Content Generation)
        if (manualBodyText) {
          candidate = {
            title: sheetInput.titleOverride || slot.topicBrief || "Bài đăng chiến dịch",
            bodyText: manualBodyText,
            outline: "Nội dung được người dùng khóa trong Campaign Content Sheet",
            mediaPrompt: "",
            voiceScript: slot.mediaType === "video" || slot.mediaType === "human-video" ? manualBodyText : "",
          };
        } else {
          candidate = await CopywriterAgentService.write(
            slot,
            campaign,
            `${researchContext}\n\n${sheetInput.contextText}`.trim(),
            lease.assertActive,
          );
        }
      }

      if (!persistedContent && sheetInput.titleOverride) candidate.title = sheetInput.titleOverride;

      // Candidate generation/scoring settles its own operation reservations.

      await lease.assertActive();
      // Serialize the final content/order/slot commit with cancellation and lease recovery.
      const nextStatus = await MarketingCampaignSlotModel.db.transaction(async (session) => {
        if (!await MarketingCampaignModel.exists({ _id: campaign._id, companyCode: slot.companyCode, status: "active" }).session(session)) return null;
        const fenced = await MarketingCampaignSlotModel.updateOne(lease.scope(), { $set: { lockedAt: new Date() } }, { session });
        if (!fenced.matchedCount) return null;
        // Create Marketing Content once; retries reuse the record for this slot.
        const content = persistedContent || await MarketingContentModel.findOneAndUpdate(
          { campaignSlotId: slot._id, companyCode: slot.companyCode },
          {
            $setOnInsert: {
              companyCode: slot.companyCode,
              authorUid: campaign.createdBy,
              campaignId: String(campaign._id),
              campaignTitle: campaign.title,
              campaignSlotId: slot._id,
              title: candidate.title,
              channel: slot.platform,
              contentType: slot.platform === "TikTok" ? "Video ngắn" : "Bài viết chiến dịch",
              status: "pending",
              bodyText: candidate.bodyText,
              outline: candidate.outline,
              mediaPrompt: candidate.mediaPrompt,
              voiceScript: candidate.voiceScript,
              mediaType: slot.mediaType === "text" ? undefined : slot.mediaType === "image" ? "image" : slot.mediaType,
              generatedAt: new Date(),
              integrationId: slot.integrationId,
            }
          },
          { upsert: true, new: true, session }
        );

        if (campaign.imageMode === "order" && slot.mediaType !== "text") {
          const isVideo = slot.mediaType === "video" || slot.mediaType === "human-video";
          const productionBrief = buildUserFacingProductionBrief({
            outline: candidate.outline,
            bodyText: candidate.bodyText,
            topicBrief: slot.topicBrief,
          });
          const generatedOrderFields = {
            title: String(candidate.title || slot.topicBrief || "Order bài viết").slice(0, 240),
            contentGroup: String(slot.pillar || "").slice(0, 240),
            shootingContent: productionBrief.shootingContent,
            productionRequirements: productionBrief.productionRequirements,
            quantitySuggestion: isVideo ? "1 video" : "1 ảnh",
            usageChannels: slot.platform,
            format: isVideo ? "video" as const : "image" as const,
            aspectRatio: isVideo ? "9:16" as const : "4:5" as const,
            headline: String(candidate.title || slot.topicBrief || "").slice(0, 120),
            subheadline: String(candidate.bodyText || "").slice(0, 220),
            visualBrief: productionBrief.visualBrief,
            videoScript: isVideo ? String(candidate.voiceScript || candidate.bodyText || "").slice(0, 4000) : "",
          };
          await CampaignAssetOrderModel.updateOne(
            {
              companyCode: slot.companyCode,
              campaignId: slot.campaignId,
              slotId: slot._id,
              manualFieldKeys: { $size: 0 },
            },
            { $set: generatedOrderFields },
            { session }
          );
          await CampaignAssetOrderModel.updateOne(
            {
              companyCode: slot.companyCode,
              campaignId: slot.campaignId,
              slotId: slot._id,
            },
            {
              $setOnInsert: {
                companyCode: slot.companyCode,
                campaignId: slot.campaignId,
                slotId: slot._id,
                createdBy: campaign.createdBy,
                ...generatedOrderFields,
                source: "manual",
                assets: [],
                manualFieldKeys: [],
                status: "needs_assets",
                revision: 0,
              },
            },
            { upsert: true, session }
          );
        }

        // Calculate next status
        const mediaSource = resolveSlotMediaSource(slot, campaign);
        const requiresManualApproval = slot.platform === "TikTok" || campaign.publishMode !== "auto";
        const nextStatus = slot.mediaType === "text"
          ? (requiresManualApproval ? "pending_approval" : "verifying")
          : mediaSource !== "ai" && !(slot.realImageDirectUrls || []).some(Boolean)
            ? "awaiting_assets"
            : "generating_media";

        const changed = await MarketingCampaignSlotModel.updateOne(
          lease.scope(),
          {
            $set: {
              status: nextStatus,
              selectedCandidateId: candidate._id || null,
              marketingContentId: content._id,
              lockId: null,
              lockedAt: null,
              lockExpiresAt: null,
            },
            $push: {
              transitions: {
                from: "writing",
                to: nextStatus,
                reason: `Đã hoàn thành nội dung bản nháp. Content Sheet row v${sheetInput.rowRevision}, config v${sheetInput.configRevision}. Chuyển sang bước kế tiếp: ${nextStatus}.`,
                at: new Date(),
              },
            },
          },
          { session }
        );
        if (!changed.matchedCount) throw Object.assign(new Error("Worker chuẩn bị đã mất khóa slot."), { code: "CAMPAIGN_SLOT_LEASE_LOST" });
        return nextStatus;
      });
      if (!nextStatus) return;

      console.log(`[Orchestrator] Slot ${slotId} prepare phase completed. Next status: ${nextStatus}`);
      emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: nextStatus });

      // Fire-and-forget: gửi thông báo phê duyệt qua Telegram nếu slot cần duyệt
      if (nextStatus === "pending_approval") {
        approvalNotifierService.notifyPendingApproval(slot, campaign).catch(() => undefined);
      }
    } catch (error: unknown) {
      if (isPrepareLeaseLost(error)) return;
      const msg = error instanceof Error ? error.message : String(error);
      const statusCode = typeof error === "object" && error !== null
        ? Number((error as { statusCode?: unknown }).statusCode || 0)
        : 0;
      const isBudgetError = statusCode === 402;
      const attemptsExhausted = slot.attemptCount >= 2;
      const targetStatus = isBudgetError || attemptsExhausted ? "needs_attention" : "retrying";
      const errorType = isBudgetError ? "budget" : attemptsExhausted ? "terminal" : "retryable";
      console.error(`[Orchestrator] Error during slot ${slotId} prepare phase:`, error);
      // Retry transient failures with a cap; budget exhaustion requires user attention.
      const changed = await MarketingCampaignSlotModel.updateOne(
        lease.scope(),
        {
          $set: {
            status: targetStatus,
            prepareAt: new Date(Date.now() + 5 * 60000), // Retry in 5 minutes
            lockId: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastError: { type: errorType, message: msg, occurredAt: new Date() },
          },
          $inc: { attemptCount: 1 },
          $push: {
            transitions: {
              from: slot.status,
              to: targetStatus,
              reason: `Lỗi Prepare Phase: ${msg}`,
              at: new Date(),
            },
          },
        }
      );
      if (!changed.matchedCount) return;
      emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: targetStatus });
      if (isBudgetError) {
        await MarketingCampaignModel.updateOne(
          { _id: campaign._id, companyCode: campaign.companyCode, status: "active" },
          { $set: { status: "paused" } }
        );
      }
    } finally {
      lease.stop();
    }
  }

  /**
   * Pipeline 2: Media Asset Rendering (Media Creator Agent)
   */
  public static async orchestrateMedia(slotId: string, lockId: string): Promise<void> {
    if (getAiUsageContext()?.slotId !== slotId) {
      const scope = await MarketingCampaignSlotModel.findById(slotId).select("companyCode campaignId").lean();
      if (!scope) return;
      return withAiUsage({ companyCode: scope.companyCode, campaignId: String(scope.campaignId), slotId }, () => this.orchestrateMedia(slotId, lockId));
    }
    if (!await guardCampaignSlot(slotId, lockId)) return;
    const slot = await MarketingCampaignSlotModel.findOne({
      _id: slotId,
      lockId,
      status: "generating_media",
    });
    if (!slot) return;

    const campaign = await MarketingCampaignModel.findOne({
      _id: slot.campaignId,
      companyCode: slot.companyCode,
      status: "active",
    });
    if (!campaign) {
      await releaseWithFailure(slotId, lockId, "media", new Error("Chiến dịch liên kết không hoạt động hoặc không tồn tại."));
      return;
    }

    const mediaLeaseMs = 20 * 60 * 1000;
    const heartbeat = setInterval(() => {
      void MarketingCampaignSlotModel.updateOne(
        { _id: slotId, lockId, status: "generating_media" },
        {
          $set: {
            lockedAt: new Date(),
            lockExpiresAt: new Date(Date.now() + mediaLeaseMs),
          },
        }
      ).catch((error: unknown) => {
        console.error(
          `[Orchestrator] Unable to renew media lease for slot ${slotId}:`,
          error
        );
      });
    }, Math.floor(mediaLeaseMs / 4));
    heartbeat.unref?.();

    try {
      const nextStatus = slot.platform === "TikTok" || campaign.publishMode !== "auto"
        ? "pending_approval"
        : "verifying";

      if ((slot.mediaType === "video" || slot.mediaType === "human-video") && !(slot.realImageDirectUrls || []).some(Boolean)) {
        const content = await MarketingContentModel.findOne({ _id: slot.marketingContentId, companyCode: slot.companyCode });
        if (content?.videoUrl && /^https:\/\//i.test(content.videoUrl)) {
          slot.realImageDirectUrls = [content.videoUrl];
        } else {
          const result = await MarketingCampaignSlotModel.updateOne(
            { _id: slot._id, lockId, status: "generating_media" },
            {
              $set: { status: "awaiting_assets", lockId: null, lockedAt: null, lockExpiresAt: null },
              $push: { transitions: { from: "generating_media", to: "awaiting_assets", reason: "Chờ khách hàng tải video lên.", at: new Date() } },
            }
          );
          if (result.modifiedCount) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: "awaiting_assets" });
          return;
        }
      }
      if (resolveSlotMediaSource(slot, campaign) !== "ai") {
        await ingestRealMedia(slot, campaign);
        const content = await MarketingContentModel.findOne({
          _id: slot.marketingContentId,
          companyCode: slot.companyCode,
        });
        if (content) {
          const uploadedUrls = (slot.ingestedMedia || []).map((item) => item.url);
          if (uploadedUrls.length === 0) {
            throw new Error("Media thật chưa được ingest lên Cloudinary.");
          }

          if (slot.mediaType === "video" || slot.mediaType === "human-video") {
            content.videoUrl = uploadedUrls[0] || "";
            content.mediaUrls = uploadedUrls;
            content.mediaType = "video";
          } else {
            content.imageUrl = uploadedUrls[0] || "";
            content.mediaUrls = uploadedUrls;
            content.mediaType = "image";
          }
          await content.save();
          if (
            content.videoUrl &&
            (slot.mediaType === "video" ||
              slot.mediaType === "human-video")
          ) {
            await applyCampaignVideoCaption({
              campaign,
              slot,
              content,
              videoUrl: content.videoUrl,
            });
          }
        }

        await MarketingCampaignSlotModel.updateOne(
          { _id: slot._id, lockId },
          {
            $set: {
              status: nextStatus,
              lockId: null,
              lockedAt: null,
              lockExpiresAt: null,
            },
            $push: {
              transitions: {
                from: "generating_media",
                to: nextStatus,
                reason: `Đã tải lên và gán liên kết ảnh thật CDN Cloudinary. Chuyển sang bước: ${nextStatus}.`,
                at: new Date(),
              },
            },
          }
        );
        console.log(`[Orchestrator] Slot ${slotId} uploaded and linked real images from Drive/Cloudinary. Next status: ${nextStatus}`);
        emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: nextStatus });

        // Fire-and-forget: gửi thông báo phê duyệt qua Telegram nếu slot cần duyệt
        if (nextStatus === "pending_approval") {
          approvalNotifierService.notifyPendingApproval(slot, campaign).catch(() => undefined);
        }
      } else {
        // Run Media Creator Agent (AI Generation)
        await MediaCreatorAgentService.createMedia(slot, campaign);

        await MarketingCampaignSlotModel.updateOne(
          { _id: slot._id, lockId },
          {
            $set: {
              status: nextStatus,
              lockId: null,
              lockedAt: null,
              lockExpiresAt: null,
            },
            $push: {
              transitions: {
                from: "generating_media",
                to: nextStatus,
                reason: `Media Creator Agent đã tạo ảnh thành công. Chuyển sang bước: ${nextStatus}.`,
                at: new Date(),
              },
            },
          }
        );
        console.log(`[Orchestrator] Slot ${slotId} media phase completed. Next status: ${nextStatus}`);
        emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: nextStatus });

        // Fire-and-forget: gửi thông báo phê duyệt qua Telegram nếu slot cần duyệt
        if (nextStatus === "pending_approval") {
          approvalNotifierService.notifyPendingApproval(slot, campaign).catch(() => undefined);
        }
      }
    } catch (error: unknown) {
      console.error(`[Orchestrator] Error during slot ${slotId} media phase:`, error);
      const status = await releaseWithFailure(slotId, lockId, "media", error);
      if (status) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status });
    } finally {
      clearInterval(heartbeat);
    }
  }

  /**
   * Pipeline 3: Quality Control & Verifying (QC Agent)
   */
  public static async orchestrateVerify(slotId: string, lockId: string): Promise<void> {
    if (getAiUsageContext()?.slotId !== slotId) {
      const scope = await MarketingCampaignSlotModel.findById(slotId).select("companyCode campaignId").lean();
      if (!scope) return;
      return withAiUsage({ companyCode: scope.companyCode, campaignId: String(scope.campaignId), slotId }, () => this.orchestrateVerify(slotId, lockId));
    }
    if (!await guardCampaignSlot(slotId, lockId)) return;
    const slot = await MarketingCampaignSlotModel.findOne({
      _id: slotId,
      lockId,
      status: "verifying",
    });
    if (!slot) return;

    const campaign = await MarketingCampaignModel.findOne({
      _id: slot.campaignId,
      companyCode: slot.companyCode,
      status: "active",
    });
    if (!campaign) {
      await releaseWithFailure(slotId, lockId, "verify", new Error("Chiến dịch liên kết không hoạt động hoặc không tồn tại."));
      return;
    }

    try {
      // Run QC Agent verification
      const qcResult = await QcAgentService.verify(slot, campaign);

      if (qcResult.passed) {
        const session = await mongoose.startSession();
        let changed = false;
        try {
          await session.withTransaction(async () => {
            const result = await MarketingCampaignSlotModel.updateOne(
              { _id: slot._id, lockId },
              {
                $set: {
                  status: "ready_to_publish",
                  lockId: null,
                  lockedAt: null,
                  lockExpiresAt: null,
                  lastError: null,
                },
                $push: {
                  transitions: {
                    from: "verifying",
                    to: "ready_to_publish",
                    reason: `QC Agent đã duyệt bài viết (Score: ${qcResult.score}/10). Sẵn sàng đăng bài.`,
                    at: new Date(),
                  },
                },
              },
              { session },
            );
            changed = result.modifiedCount > 0;
            if (changed) await syncCampaignContentReady(slot, session);
          });
        } finally {
          await session.endSession();
        }
        console.log(`[Orchestrator] Slot ${slotId} QC passed. Status transitioned to ready_to_publish.`);
        if (changed) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: "ready_to_publish" });
      } else {
        // Did not pass QC validation
        const failureReason = qcResult.reasons.join("; ") || "Nội dung không đạt kiểm duyệt. Vui lòng kiểm tra và duyệt lại.";
        const session = await mongoose.startSession();
        let changed = false;
        try {
          await session.withTransaction(async () => {
            const result = await MarketingCampaignSlotModel.updateOne(
              { _id: slot._id, lockId },
              {
                $set: {
                  status: "needs_attention",
                  lockId: null,
                  lockedAt: null,
                  lockExpiresAt: null,
                  lastError: { type: "validation", message: failureReason, occurredAt: new Date() },
                },
                $push: {
                  transitions: {
                    from: "verifying",
                    to: "needs_attention",
                    reason: `QC Agent từ chối duyệt: ${failureReason}`,
                    at: new Date(),
                  },
                },
              },
              { session },
            );
            changed = result.modifiedCount > 0;
            if (changed) await syncCampaignContentFailure(slot, failureReason, session);
          });
        } finally {
          await session.endSession();
        }
        console.log(`[Orchestrator] Slot ${slotId} QC failed: ${failureReason}`);
        if (changed) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: "needs_attention" });
      }
    } catch (error: unknown) {
      console.error(`[Orchestrator] Error during slot ${slotId} verify phase:`, error);
      const status = await releaseWithFailure(slotId, lockId, "verify", error);
      if (status) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status });
    }
  }

  /**
   * Pipeline 4: Publishing (Publisher Agent)
   */
  public static async orchestratePublish(slotId: string, lockId: string): Promise<void> {
    if (!await guardCampaignSlot(slotId, lockId)) return;
    const slot = await MarketingCampaignSlotModel.findOne({
      _id: slotId,
      lockId,
      status: "publishing",
    });
    if (!slot) return;

    const campaign = await MarketingCampaignModel.findOne({
      _id: slot.campaignId,
      companyCode: slot.companyCode,
      status: "active",
    });
    if (!campaign) {
      await releaseWithFailure(slotId, lockId, "publish", new Error("Chiến dịch liên kết không hoạt động hoặc không tồn tại."));
      return;
    }

    try {
      // Run Publisher Agent
      const publishResult = await PublisherAgentService.publish(slot, campaign);

      if (publishResult.status === "published") {
        const transitioned = await MarketingCampaignSlotModel.updateOne(
          { _id: slot._id, lockId },
          {
            $set: {
              status: "published",
              publishedPostId: publishResult.postId,
              publishedUrl: publishResult.postUrl,
              lockId: null,
              lockedAt: null,
              lockExpiresAt: null,
            },
            $push: {
              transitions: {
                from: "publishing",
                to: "published",
                reason: "Publisher Agent đã hoàn tất đăng bài lên Facebook thành công.",
                at: new Date(),
              },
            },
          }
        );
        console.log(`[Orchestrator] Slot ${slotId} published successfully.`);
        if (transitioned.modifiedCount) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: "published" });
      } else {
        // Status is "publishing" (async webhook callback pending)
        const transitioned = await MarketingCampaignSlotModel.updateOne(
          { _id: slot._id, lockId },
          {
            $set: {
              lockId: null,
              lockedAt: null,
              lockExpiresAt: null,
            },
            $push: {
              transitions: {
                from: "publishing",
                to: "publishing",
                reason: "Publisher Agent đã gửi yêu cầu đăng bài. Đang chờ callback từ n8n webhook.",
                at: new Date(),
              },
            },
          }
        );
        console.log(`[Orchestrator] Slot ${slotId} publish requested. Awaiting callback.`);
        if (transitioned.modifiedCount) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: "publishing" });
      }
    } catch (error: unknown) {
      console.error(`[Orchestrator] Error during slot ${slotId} publish phase:`, error);
      await releaseWithFailure(slotId, lockId, "publish", error);
      const current = await MarketingCampaignSlotModel.findOne({ _id: slot._id, companyCode: slot.companyCode }).select("status").lean();
      if (current) emitSlotUpdate({ _id: slot._id, campaignId: slot.campaignId, companyCode: slot.companyCode, status: current.status });
    }
  }
}
