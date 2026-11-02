/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model.ts";
import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";
import { SocialPostMetricModel } from "../model/social-post-metric.model.ts";
import { campaignAnalyticsDateScope, campaignSlotCostLookup } from "./campaign-analytics-scope";

export class MarketingAnalyticsService {
  public static async getCampaignAnalytics(
    companyCode: string,
    filters: {
      campaignId?: string;
      platform?: string;
      startDate?: string;
      endDate?: string;
      assistantSummary?: boolean;
    }
  ) {
    // 1. Xây dựng match filters cho slots
    const slotMatch: any = { companyCode };

    if (filters.campaignId) {
      slotMatch.campaignId = new Types.ObjectId(filters.campaignId);
    }
    if (filters.platform) {
      slotMatch.platform = filters.platform;
    }
    Object.assign(slotMatch, await campaignAnalyticsDateScope(companyCode, filters));

    // Match filter cho metrics (tương ứng với các slot khớp bộ lọc)
    const metricMatch: any = { companyCode };
    if (filters.campaignId) {
      metricMatch.campaignId = new Types.ObjectId(filters.campaignId);
    }
    if (filters.platform) {
      metricMatch.platform = filters.platform;
    }

    // Nếu lọc theo thời gian của slot, ta cần lấy danh sách slotId khớp trước
    if (filters.startDate || filters.endDate) {
      const matchingSlotIds = await MarketingCampaignSlotModel.find(slotMatch)
        .select("_id")
        .lean();
      metricMatch.slotId = { $in: matchingSlotIds.map((s) => s._id) };
    }

    // 2. Query song song các pipelines
    const [
      overview,
      platformMetrics,
      byPlatform,
      byDate,
      qualityScores,
      byPillar,
      topErrors,
      campaigns,
      posts,
      byFunnelRaw,
      byMediaRaw,
    ] = await Promise.all([
      // Aggregation 1: Tổng quan slot (Total, Published, AI Cost)
      MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        campaignSlotCostLookup(),
        {
          $group: {
            _id: null,
            totalSlots: { $sum: 1 },
            publishedSlots: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            failedSlots: {
              $sum: { $cond: [{ $in: ["$status", ["failed", "needs_attention"]] }, 1, 0] },
            },
            pendingApprovalSlots: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [
                        "draft",
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
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalAiCost: {
              $sum: {
                $ifNull: [
                  { $arrayElemAt: ["$walletCost.amount", 0] },
                  0,
                ],
              },
            },
            totalAttempts: { $sum: "$attemptCount" },
          },
        },
      ]),

      // Aggregation 2: Tổng hợp metrics thực tế từ nền tảng
      SocialPostMetricModel.aggregate([
        { $match: metricMatch },
        {
          $group: {
            _id: null,
            totalLikes: { $sum: "$likes" },
            totalComments: { $sum: "$comments" },
            totalShares: { $sum: "$shares" },
            totalViews: { $sum: "$views" },
            totalReach: { $sum: "$reach" },
            totalImpressions: { $sum: "$impressions" },
            totalClicks: { $sum: "$clicks" },
          },
        },
      ]),

      // Aggregation 3: Thống kê theo Kênh (Platform)
      MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        {
          $group: {
            _id: "$platform",
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $in: ["$status", ["failed", "needs_attention"]] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: "socialpostmetrics",
            let: { platformName: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$platform", "$$platformName"] },
                      { $eq: ["$companyCode", companyCode] },
                      ...(metricMatch.campaignId
                        ? [{ $eq: ["$campaignId", metricMatch.campaignId] }]
                        : []),
                      ...(metricMatch.slotId
                        ? [{ $in: ["$slotId", metricMatch.slotId.$in] }]
                        : []),
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  likes: { $sum: "$likes" },
                  comments: { $sum: "$comments" },
                  shares: { $sum: "$shares" },
                  views: { $sum: "$views" },
                  reach: { $sum: "$reach" },
                },
              },
            ],
            as: "m",
          },
        },
        {
          $project: {
            platform: "$_id",
            total: 1,
            published: 1,
            failed: 1,
            likes: { $ifNull: [{ $arrayElemAt: ["$m.likes", 0] }, 0] },
            comments: { $ifNull: [{ $arrayElemAt: ["$m.comments", 0] }, 0] },
            shares: { $ifNull: [{ $arrayElemAt: ["$m.shares", 0] }, 0] },
            views: { $ifNull: [{ $arrayElemAt: ["$m.views", 0] }, 0] },
            reach: { $ifNull: [{ $arrayElemAt: ["$m.reach", 0] }, 0] },
          },
        },
      ]),

      // Aggregation 4: Thống kê theo ngày (Time series)
      MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        { $lookup: { from: MarketingCampaignModel.collection.name, localField: "campaignId", foreignField: "_id", as: "campaignTimezone" } },
        {
          $project: {
            dateStr: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$scheduledAt",
                timezone: { $ifNull: [{ $arrayElemAt: ["$campaignTimezone.timezone", 0] }, "Asia/Ho_Chi_Minh"] },
              },
            },
            status: 1,
            slotId: "$_id",
          },
        },
        {
          $group: {
            _id: "$dateStr",
            planned: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $in: ["$status", ["failed", "needs_attention"]] }, 1, 0] },
            },
            slotIds: { $push: "$slotId" },
          },
        },
        { $sort: { _id: 1 } },
        {
          $lookup: {
            from: "socialpostmetrics",
            let: { ids: "$slotIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$slotId", "$$ids"] },
                },
              },
              {
                $group: {
                  _id: null,
                  likes: { $sum: "$likes" },
                  views: { $sum: "$views" },
                },
              },
            ],
            as: "m",
          },
        },
        {
          $project: {
            date: "$_id",
            planned: 1,
            published: 1,
            failed: 1,
            likes: { $ifNull: [{ $arrayElemAt: ["$m.likes", 0] }, 0] },
            views: { $ifNull: [{ $arrayElemAt: ["$m.views", 0] }, 0] },
          },
        },
      ]),

      // Aggregation 5: Điểm chất lượng AI (chỉ lấy từ các candidates được chọn)
      MarketingCampaignSlotModel.aggregate([
        {
          $match: {
            ...slotMatch,
            selectedCandidateId: { $exists: true, $ne: null },
          },
        },
        {
          $lookup: {
            from: "marketingcandidates",
            localField: "selectedCandidateId",
            foreignField: "_id",
            as: "c",
          },
        },
        { $unwind: "$c" },
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$c.score" },
            fidelity: { $avg: "$c.scoreDetails.fidelity" },
            objective: { $avg: "$c.scoreDetails.objective" },
            platform: { $avg: "$c.scoreDetails.platform" },
            hook: { $avg: "$c.scoreDetails.hook" },
            conversion: { $avg: "$c.scoreDetails.conversion" },
            readability: { $avg: "$c.scoreDetails.readability" },
            novelty: { $avg: "$c.scoreDetails.novelty" },
          },
        },
      ]),

      // Aggregation 6: Thống kê theo Content Pillar
      filters.assistantSummary ? Promise.resolve([]) : MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        campaignSlotCostLookup(),
        {
          $group: {
            _id: "$pillar",
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
            cost: {
              $sum: {
                $ifNull: [{ $arrayElemAt: ["$walletCost.amount", 0] }, 0],
              },
            },
            slotIds: { $push: "$_id" },
          },
        },
        {
          $lookup: {
            from: "socialpostmetrics",
            let: { ids: "$slotIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$slotId", "$$ids"] },
                },
              },
              {
                $group: {
                  _id: null,
                  likes: { $sum: "$likes" },
                  views: { $sum: "$views" },
                },
              },
            ],
            as: "m",
          },
        },
        {
          $project: {
            pillar: { $cond: [{ $eq: ["$_id", ""] }, "Khác", "$_id"] },
            total: 1,
            published: 1,
            avgCost: { $cond: [{ $gt: ["$total", 0] }, { $divide: ["$cost", "$total"] }, 0] },
            likes: { $ifNull: [{ $arrayElemAt: ["$m.likes", 0] }, 0] },
            views: { $ifNull: [{ $arrayElemAt: ["$m.views", 0] }, 0] },
          },
        },
      ]),

      // Aggregation 7: Top lỗi đăng bài
      filters.assistantSummary ? Promise.resolve([]) : MarketingCampaignSlotModel.aggregate([
        {
          $match: {
            ...slotMatch,
            lastError: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: {
              type: "$lastError.type",
              message: "$lastError.message",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            errorType: "$_id.type",
            message: "$_id.message",
            count: 1,
            _id: 0,
          },
        },
      ]),

      // Aggregation 8: Danh sách chiến dịch để đổ vào Dropdown bộ lọc
      MarketingCampaignModel.find({ companyCode, ...(filters.assistantSummary && filters.campaignId ? { _id: new Types.ObjectId(filters.campaignId) } : {}) })
        .select("_id title status startDate endDate")
        .sort({ createdAt: -1 })
        .lean(),

      // Aggregation 9: Danh sách tất cả các slot bài đăng kèm metrics thực tế (nếu có) và đường dẫn bài đăng
      filters.assistantSummary ? Promise.resolve([]) : MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        { $sort: { scheduledAt: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: "marketingcontents",
            localField: "marketingContentId",
            foreignField: "_id",
            as: "content",
          },
        },
        {
          $lookup: {
            from: "socialpostmetrics",
            localField: "_id",
            foreignField: "slotId",
            as: "metrics",
          },
        },
        {
          $project: {
            _id: 1,
            platform: "$platform",
            postId: {
              $ifNull: [
                { $arrayElemAt: ["$metrics.postId", 0] },
                { $ifNull: ["$publishedPostId", ""] },
              ],
            },
            postUrl: {
              $ifNull: [
                { $arrayElemAt: ["$metrics.postUrl", 0] },
                {
                  $ifNull: [
                    "$publishedUrl",
                    {
                      $ifNull: [
                        { $arrayElemAt: ["$content.postUrl", 0] },
                        { $ifNull: [{ $arrayElemAt: ["$content.facebookShareUrl", 0] }, ""] },
                      ],
                    },
                  ],
                },
              ],
            },
            likes: { $ifNull: [{ $arrayElemAt: ["$metrics.likes", 0] }, 0] },
            comments: { $ifNull: [{ $arrayElemAt: ["$metrics.comments", 0] }, 0] },
            shares: { $ifNull: [{ $arrayElemAt: ["$metrics.shares", 0] }, 0] },
            views: { $ifNull: [{ $arrayElemAt: ["$metrics.views", 0] }, 0] },
            reach: { $ifNull: [{ $arrayElemAt: ["$metrics.reach", 0] }, 0] },
            impressions: { $ifNull: [{ $arrayElemAt: ["$metrics.impressions", 0] }, 0] },
            clicks: { $ifNull: [{ $arrayElemAt: ["$metrics.clicks", 0] }, 0] },
            syncedAt: {
              $ifNull: [
                { $arrayElemAt: ["$metrics.syncedAt", 0] },
                "$updatedAt",
              ],
            },
            slotId: {
              _id: "$_id",
              topicBrief: "$topicBrief",
              pillar: "$pillar",
              scheduledAt: "$scheduledAt",
              mediaType: "$mediaType",
              status: "$status",
            },
          },
        },
      ]),

      // Aggregation 10: Thống kê theo Phễu Marketing (TOFU / MOFU / BOFU)
      filters.assistantSummary ? Promise.resolve([]) : MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        { $group: { _id: "$funnelStage", count: { $sum: 1 } } },
      ]),

      // Aggregation 11: Thống kê theo Loại Đa Phương Tiện
      filters.assistantSummary ? Promise.resolve([]) : MarketingCampaignSlotModel.aggregate([
        { $match: slotMatch },
        { $group: { _id: "$mediaType", count: { $sum: 1 } } },
      ]),
    ]);

    // 3. Chuẩn hóa dữ liệu trả về
    const ov = overview[0] || {
      totalSlots: 0,
      publishedSlots: 0,
      failedSlots: 0,
      pendingApprovalSlots: 0,
      totalAiCost: 0,
      totalAttempts: 0,
    };

    const pm = platformMetrics[0] || {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0,
      totalReach: 0,
      totalImpressions: 0,
      totalClicks: 0,
    };

    const qs = qualityScores[0] || {
      avgScore: 0,
      fidelity: 0,
      objective: 0,
      platform: 0,
      hook: 0,
      conversion: 0,
      readability: 0,
      novelty: 0,
    };

    const successRate =
      ov.totalSlots > 0 ? Math.round((ov.publishedSlots / ov.totalSlots) * 100) : 0;

    const avgAttemptCount =
      ov.totalSlots > 0 ? parseFloat((ov.totalAttempts / ov.totalSlots).toFixed(2)) : 0;

    const avgEngagementPerPost =
      ov.publishedSlots > 0
          ? parseFloat(
              ((pm.totalLikes + pm.totalComments + pm.totalShares) / ov.publishedSlots).toFixed(2)
            )
          : 0;

    const postList = posts || [];

    const totalFunnelSlots = byFunnelRaw.reduce((acc: number, curr: any) => acc + curr.count, 0) || 1;
    const funnelMap = new Map(byFunnelRaw.map((item: any) => [item._id || "MOFU", item.count]));

    const byFunnel = [
      {
        stage: "TOFU" as const,
        label: "Nhận biết thương hiệu (TOFU)",
        desc: "Thu hút độc giả mới, mở rộng tiếp cận",
        count: funnelMap.get("TOFU") || 0,
        percentage: Math.round(((funnelMap.get("TOFU") || 0) / totalFunnelSlots) * 100),
        color: "from-blue-500 to-indigo-600",
      },
      {
        stage: "MOFU" as const,
        label: "Tương tác & Đánh giá (MOFU)",
        desc: "Cung cấp giá trị chuyên sâu, giữ chân khách hàng",
        count: funnelMap.get("MOFU") || 0,
        percentage: Math.round(((funnelMap.get("MOFU") || 0) / totalFunnelSlots) * 100),
        color: "from-purple-500 to-pink-600",
      },
      {
        stage: "BOFU" as const,
        label: "Chuyển đổi & Chốt đơn (BOFU)",
        desc: "Thúc đẩy đăng ký, mua hàng & gọi hotline/inbox",
        count: funnelMap.get("BOFU") || 0,
        percentage: Math.round(((funnelMap.get("BOFU") || 0) / totalFunnelSlots) * 100),
        color: "from-emerald-500 to-teal-600",
      },
    ];

    const totalMediaSlots = byMediaRaw.reduce((acc: number, curr: any) => acc + curr.count, 0) || 1;
    const mediaMap = new Map(byMediaRaw.map((item: any) => [item._id || "image", item.count]));

    const byMediaType = [
      {
        mediaType: "image" as const,
        label: "Hình ảnh (Image)",
        count: mediaMap.get("image") || 0,
        percentage: Math.round(((mediaMap.get("image") || 0) / totalMediaSlots) * 100),
      },
      {
        mediaType: "video" as const,
        label: "Video ngắn / Reel",
        count: mediaMap.get("video") || 0,
        percentage: Math.round(((mediaMap.get("video") || 0) / totalMediaSlots) * 100),
      },
      {
        mediaType: "human-video" as const,
        label: "Video MC người ảo AI",
        count: mediaMap.get("human-video") || 0,
        percentage: Math.round(((mediaMap.get("human-video") || 0) / totalMediaSlots) * 100),
      },
      {
        mediaType: "text" as const,
        label: "Bài viết chữ (Text-only)",
        count: mediaMap.get("text") || 0,
        percentage: Math.round(((mediaMap.get("text") || 0) / totalMediaSlots) * 100),
      },
    ];

    return {
      overview: {
        totalSlots: ov.totalSlots,
        publishedSlots: ov.publishedSlots,
        failedSlots: ov.failedSlots,
        pendingApprovalSlots: ov.pendingApprovalSlots,
        successRate,
        totalAiCost: parseFloat(ov.totalAiCost.toFixed(4)),
        avgAttemptCount,
      },
      platformMetrics: {
        totalLikes: pm.totalLikes,
        totalComments: pm.comments || pm.totalComments,
        totalShares: pm.shares || pm.totalShares,
        totalViews: pm.totalViews,
        totalReach: pm.totalReach,
        totalImpressions: pm.totalImpressions,
        totalClicks: pm.totalClicks,
        avgEngagementPerPost,
      },
      byPlatform,
      byDate,
      qualityScores: {
        avgScore: Math.round(qs.avgScore || 0),
        byDimension: {
          fidelity: Math.round(qs.fidelity || 0),
          objective: Math.round(qs.objective || 0),
          platform: Math.round(qs.platform || 0),
          hook: Math.round(qs.hook || 0),
          conversion: Math.round(qs.conversion || 0),
          readability: Math.round(qs.readability || 0),
          novelty: Math.round(qs.novelty || 0),
        },
      },
      byPillar,
      byFunnel,
      byMediaType,
      topErrors,
      campaigns,
      posts: postList,
    };
  }

  public static async getAssistantCampaignAnalytics(
    companyCode: string,
    filters: { campaignId: string; platform?: string; startDate: string; endDate: string },
  ) {
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const timestamp = Date.parse(`${value}T00:00:00.000Z`);
      return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
    };
    if (!/^[a-f\d]{24}$/i.test(filters.campaignId)) throw new Error("Hãy chọn một chiến dịch trong danh sách theo tên.");
    if (!validDate(filters.startDate) || !validDate(filters.endDate) || filters.startDate > filters.endDate) {
      throw new Error("Khoảng ngày cần hợp lệ và theo định dạng YYYY-MM-DD.");
    }
    const dayCount = (Date.parse(`${filters.endDate}T00:00:00.000Z`) - Date.parse(`${filters.startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
    if (dayCount > 31) throw new Error("Báo cáo trợ lý hỗ trợ tối đa 31 ngày cho mỗi chiến dịch.");
    if (filters.platform && !["Facebook", "TikTok"].includes(filters.platform)) throw new Error("Kênh cần là Facebook hoặc TikTok.");

    const campaign = await MarketingCampaignModel.findOne({ _id: new Types.ObjectId(filters.campaignId), companyCode })
      .select("title")
      .lean();
    if (!campaign) throw new Error("Không tìm thấy chiến dịch trong doanh nghiệp hiện tại.");

    const analytics = await this.getCampaignAnalytics(companyCode, { ...filters, assistantSummary: true });
    return {
      campaignTitle: campaign.title,
      startDate: filters.startDate,
      endDate: filters.endDate,
      platform: filters.platform || "all",
      overview: analytics.overview,
      platformMetrics: analytics.platformMetrics,
      byPlatform: analytics.byPlatform,
      byDate: analytics.byDate,
      qualityScores: analytics.qualityScores,
    };
  }
}
