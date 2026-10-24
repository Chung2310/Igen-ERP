import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import mongoose, { type ClientSession } from "mongoose";
import { MarketingCampaignModel } from "../../model/marketing-campaign.model.ts";
import { MarketingCampaignSlotModel } from "../../model/marketing-campaign-slot.model.ts";
import { MarketingContentModel } from "../../model/marketing-content.model";
import type { IMarketingCampaignSlot, MarketingCampaignSlotStatus } from "../../interface/marketing-campaign-slot.interface";
import { SocialIntegrationModel } from "../../../shared/model/social-integration.model.ts";
import { UserModel } from "../../../../../model/user.model.ts";

export function loadAgentSkill(name: string): string {
  try {
    const filePath = path.join(process.cwd(), "server", "modules", "marketing-suite", "campaign", "service", "agents", "skills", `${name}.md`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    // Fallback search
    const fallbackPath = path.join(__dirname, "skills", `${name}.md`);
    if (fs.existsSync(fallbackPath)) {
      return fs.readFileSync(fallbackPath, "utf-8");
    }
    return "";
  } catch (error) {
    console.error(`[loadAgentSkill] Error loading skill ${name}:`, error);
    return "";
  }
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(value: string): string {
  return createHash("sha256").update(normalizeText(value)).digest("hex");
}

export function similarity(left: string, right: string): number {
  const a = new Set(normalizeText(left).split(" ").filter((word) => word.length > 2));
  const b = new Set(normalizeText(right).split(" ").filter((word) => word.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

export async function assertReachableMedia(url: string): Promise<void> {
  if (!/^https:\/\//i.test(url)) {
    throw new Error("Media URL không dùng HTTPS.");
  }
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Media URL không truy cập được (${response.status}).`);
  }
}

export async function resolveFacebookCredentials(input: {
  companyCode: string;
  createdBy: string;
  integrationId?: unknown;
  expectedPageId?: string;
}) {
  const assertSelectedPage = (pageId: string) => {
    if (input.expectedPageId && input.expectedPageId !== pageId) {
      throw Object.assign(new Error("Fanpage được chọn không khớp với slot. Vui lòng cập nhật Fanpage trong Campaign trước khi đăng."), { statusCode: 409 });
    }
  };
  // 1. If integrationId is provided, attempt lookup in SocialIntegrationModel
  if (input.integrationId) {
    const integration = await SocialIntegrationModel.findOne({
      _id: input.integrationId,
      companyCode: input.companyCode,
      platform: "Facebook",
      isConnected: true,
    }).lean();
    if (integration?.username && integration.accessToken) {
      assertSelectedPage(integration.username);
      return {
        pageId: integration.username,
        accessToken: integration.accessToken,
        isMock: !!integration.isMock,
      };
    }
    throw new Error("Fanpage đã chọn chưa có kết nối Facebook hợp lệ. Vui lòng kết nối lại đúng Fanpage.");
  }

  // 2. Fallback: Check creator user's personal Facebook connection
  const user = await UserModel.findById(input.createdBy).select("companyCode facebookIntegration").lean();
  if (
    user &&
    user.companyCode === input.companyCode &&
    user.facebookIntegration?.isConnected &&
    user.facebookIntegration.pageId &&
    user.facebookIntegration.pageAccessToken
  ) {
    assertSelectedPage(user.facebookIntegration.pageId);
    return {
      pageId: user.facebookIntegration.pageId,
      accessToken: user.facebookIntegration.pageAccessToken,
      isMock: !!user.facebookIntegration.isMock,
    };
  }

  throw new Error("Tác giả chưa kết nối Facebook Page. Vui lòng chọn đúng Fanpage cho chiến dịch.");
}

export async function syncCampaignContentFailure(
  slot: Pick<IMarketingCampaignSlot, "_id" | "campaignId" | "companyCode" | "marketingContentId">,
  message: string,
  session: ClientSession,
) {
  if (!slot.marketingContentId) return;
  await MarketingContentModel.updateOne({
    _id: slot.marketingContentId, companyCode: slot.companyCode,
    campaignId: String(slot.campaignId), campaignSlotId: slot._id,
    // A provider callback remains authoritative once delivery has started.
    status: { $nin: ["published", "processing"] },
  }, { $set: { status: "failed", publishError: message } }, { session });
}

export async function syncCampaignContentReady(
  slot: Pick<IMarketingCampaignSlot, "_id" | "campaignId" | "companyCode" | "marketingContentId">,
  session: ClientSession,
) {
  if (!slot.marketingContentId) return;
  await MarketingContentModel.updateOne({
    _id: slot.marketingContentId, companyCode: slot.companyCode,
    campaignId: String(slot.campaignId), campaignSlotId: slot._id,
    status: { $nin: ["published", "processing"] },
  }, { $set: { status: "scheduled" }, $unset: { publishError: 1 } }, { session });
}

export async function releaseWithFailure(
  slotId: unknown,
  lockId: string,
  stage: string,
  error: unknown
): Promise<MarketingCampaignSlotStatus | undefined> {
  const message = error instanceof Error ? error.message : String(error);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, lockId })
        .select("attemptCount status campaignId companyCode marketingContentId")
        .session(session)
        .lean();
      if (!slot) return;

      const budget = (error as { code?: string })?.code === "AI_SUBSCRIPTION_LIMIT";
      const validation = (error as { code?: string })?.code === "CAMPAIGN_MEDIA_NOT_READY";
      const terminal = budget || validation || slot.attemptCount >= 2;
      const targetStatus = terminal ? "needs_attention" : slot.status;

      const result = await MarketingCampaignSlotModel.updateOne(
        { _id: slotId, lockId },
        {
          $set: {
            status: targetStatus,
            lockId: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastError: { type: budget ? "budget" : validation ? "validation" : terminal ? "terminal" : "provider", message, occurredAt: new Date() },
          },
          $inc: { attemptCount: 1 },
          $push: {
            transitions: {
              from: slot.status,
              to: targetStatus,
              reason: `${stage}: ${message}`,
              at: new Date(),
            },
          },
        },
        { session },
      );

      if (terminal && result.modifiedCount > 0) {
        await syncCampaignContentFailure(slot, message, session);
        await MarketingCampaignModel.updateOne({ _id: slot.campaignId, companyCode: slot.companyCode }, { $inc: { "statistics.failedSlots": 1 } }, { session });
      }
      return result.modifiedCount > 0 ? targetStatus : undefined;
    });
  } finally {
    await session.endSession();
  }
}
