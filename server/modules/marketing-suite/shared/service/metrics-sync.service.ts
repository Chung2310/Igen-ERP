/* eslint-disable @typescript-eslint/no-explicit-any */
import { MarketingCampaignSlotModel } from "../../campaign/model/marketing-campaign-slot.model.ts";
import { MarketingCampaignModel } from "../../campaign/model/marketing-campaign.model.ts";
import { SocialIntegrationModel } from "../model/social-integration.model.ts";
import { UserModel } from "../../../../model/user.model.ts";
import { SocialPostMetricModel } from "../../campaign/model/social-post-metric.model.ts";
import { companyModuleEnabled } from "../access";

export class MetricsSyncService {
  /**
   * Đồng bộ metrics cho các Facebook slot đã published
   */
  public static async syncFacebookMetrics(limit = 20): Promise<{
    processed: number;
    success: number;
    failed: number;
    errors: string[];
  }> {
    const maxPosts = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20;
    const result = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // 1. Lấy danh sách các slot đã sync trong vòng 6 tiếng qua để loại trừ
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const recentlySynced = await SocialPostMetricModel.find({
        platform: "Facebook",
        syncedAt: { $gte: sixHoursAgo },
      } as any)
        .select("slotId")
        .lean();

      const recentlySyncedSlotIds = recentlySynced.map((m: any) => String(m.slotId));

      // 2. Tìm các slot cần sync (published trong 30 ngày qua, chưa sync hoặc sync > 6 tiếng trước)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const slots = MarketingCampaignSlotModel.find({
        platform: "Facebook",
        status: "published",
        publishedPostId: { $exists: true, $ne: "" },
        scheduledAt: { $gte: thirtyDaysAgo },
        _id: { $nin: recentlySyncedSlotIds as any },
      })
        .sort({ scheduledAt: -1, _id: 1 })
        .lean().cursor({ batchSize: 20 });

      // Cache token để tránh query lặp đi lặp lại
      const tokenCache: Record<string, { pageId: string; accessToken: string }> = {};
      const enabledCompanies = new Map<string, boolean>();

      for await (const slot of slots) {
        if (result.processed >= maxPosts) break;
        try {
          result.processed++;
          if (!enabledCompanies.has(slot.companyCode)) enabledCompanies.set(slot.companyCode, await companyModuleEnabled(slot.companyCode, "social-marketing"));
          if (!enabledCompanies.get(slot.companyCode)) { result.processed--; continue; }
          const postId = String(slot.publishedPostId || "").trim();
          if (!postId) {
            continue;
          }

          // Lấy credentials cho slot này
          let credentials = tokenCache[String(slot.integrationId || slot.campaignId)];

          if (!credentials) {
            if (slot.integrationId) {
              const integration = await SocialIntegrationModel.findOne({
                _id: slot.integrationId,
                companyCode: slot.companyCode,
                platform: "Facebook",
                isConnected: true,
              }).lean();

              if (integration?.isMock) { result.processed--; continue; }
              if (integration?.username && integration.accessToken) {
                credentials = {
                  pageId: integration.username,
                  accessToken: integration.accessToken,
                };
                tokenCache[String(slot.integrationId)] = credentials;
              }
            } else {
              const campaign = await MarketingCampaignModel.findOne({ _id: slot.campaignId, companyCode: slot.companyCode })
                .select("createdBy")
                .lean();

              if (campaign?.createdBy) {
                const user = await UserModel.findOne({ _id: campaign.createdBy, companyCode: slot.companyCode })
                  .select("companyCode facebookIntegration")
                  .lean();

                if (user?.facebookIntegration?.isMock) { result.processed--; continue; }
                if (user?.facebookIntegration?.isConnected && user.facebookIntegration.pageId && user.facebookIntegration.pageAccessToken) {
                  credentials = {
                    pageId: user.facebookIntegration.pageId,
                    accessToken: user.facebookIntegration.pageAccessToken,
                  };
                  tokenCache[String(slot.campaignId)] = credentials;
                }
              }
            }
          }

          if (!credentials?.accessToken) {
            throw new Error(`Không tìm thấy token kết nối Facebook cho slot ${slot._id}`);
          }

          // Gọi API lấy tương tác cơ bản (Likes, Comments, Shares)
          const basicUrl = `https://graph.facebook.com/v25.0/${encodeURIComponent(postId)}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(credentials.accessToken)}`;
          
          let likes = 0;
          let comments = 0;
          let shares = 0;

          const basicResponse = await fetch(basicUrl, { signal: AbortSignal.timeout(15_000) });
          if (basicResponse.ok) {
            const basicData = await basicResponse.json();
            likes = basicData.likes?.summary?.total_count || 0;
            comments = basicData.comments?.summary?.total_count || 0;
            shares = basicData.shares?.count || 0;
          } else {
            const errText = await basicResponse.text();
            throw new Error(`Graph API basic metrics error: ${basicResponse.status} - ${errText}`);
          }

          // Gọi API lấy Insights (Reach, Impressions, Clicks)
          const insightsUrl = `https://graph.facebook.com/v25.0/${encodeURIComponent(postId)}/insights?metric=post_impressions,post_impressions_unique,post_clicks&access_token=${encodeURIComponent(credentials.accessToken)}`;
          
          const insightMetrics: { impressions?: number; reach?: number; clicks?: number } = {};

          const insightsResponse = await fetch(insightsUrl, { signal: AbortSignal.timeout(15_000) });
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            const dataArray = insightsData.data || [];
            
            for (const item of dataArray) {
              const value = item.values?.[0]?.value || 0;
              if (item.name === "post_impressions") insightMetrics.impressions = value;
              if (item.name === "post_impressions_unique") insightMetrics.reach = value;
              if (item.name === "post_clicks") insightMetrics.clicks = value;
            }
          } else {
            const errText = await insightsResponse.text();
            console.warn(`[MetricsSyncService] Không thể lấy Insights cho post ${postId} (có thể Page < 100 likes hoặc thiếu quyền): ${insightsResponse.status} - ${errText}`);
            // Không throw lỗi này để vẫn lưu được Likes/Comments/Shares
          }

          // Upsert kết quả vào SocialPostMetric
          await SocialPostMetricModel.findOneAndUpdate(
            { slotId: slot._id, companyCode: slot.companyCode } as any,
            {
              $set: {
                companyCode: slot.companyCode,
                campaignId: slot.campaignId,
                platform: "Facebook",
                postId,
                postUrl: slot.publishedUrl,
                ...insightMetrics,
                likes,
                comments,
                shares,
                syncedAt: new Date(),
              },
              $unset: { syncError: 1 },
              $inc: { syncCount: 1 },
            },
            { upsert: true, new: true }
          );

          result.success++;
        } catch (slotError: any) {
          result.failed++;
          const errMsg = `Slot ${slot._id} error: ${slotError.message}`;
          result.errors.push(errMsg);
          console.error(`[MetricsSyncService] ${errMsg}`);

          // Ghi nhận lỗi vào SocialPostMetric để theo dõi
          await SocialPostMetricModel.findOneAndUpdate(
            { slotId: slot._id, companyCode: slot.companyCode } as any,
            {
              $set: {
                companyCode: slot.companyCode,
                campaignId: slot.campaignId,
                platform: "Facebook",
                postId: slot.publishedPostId || "unknown",
                postUrl: slot.publishedUrl,
                syncedAt: new Date(),
                syncError: slotError.message,
              },
              $inc: { syncCount: 1 },
            },
            { upsert: true }
          ).catch((e) => console.error(`[MetricsSyncService] Failed to log sync error: ${e.message}`));
        }
      }
    } catch (globalError: any) {
      console.error("[MetricsSyncService] Global sync error:", globalError);
      result.errors.push(`Global error: ${globalError.message}`);
    }

    return result;
  }
}
