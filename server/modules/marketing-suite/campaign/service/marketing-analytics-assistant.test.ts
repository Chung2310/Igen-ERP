import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model.ts";
import { SocialPostMetricModel } from "../model/social-post-metric.model.ts";
import { MarketingAnalyticsService } from "./marketing-analytics.service.ts";

const campaignId = "507f1f77bcf86cd799439011";
const filters = {
  campaignId,
  platform: "Facebook",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
};

function setup() {
  const campaignQuery = {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue({ title: "Chiến dịch tháng 10" }),
  };
  const findOne = vi.spyOn(MarketingCampaignModel, "findOne").mockReturnValue(campaignQuery as any);
  const analytics = vi.spyOn(MarketingAnalyticsService, "getCampaignAnalytics").mockResolvedValue({
    overview: { totalSlots: 8, publishedSlots: 5, failedSlots: 1, pendingApprovalSlots: 2, successRate: 63, totalAiCost: 3.5, avgAttemptCount: 1.25 },
    platformMetrics: { totalLikes: 20, totalComments: 3, totalShares: 2, totalViews: 50, totalReach: 40, totalImpressions: 70, totalClicks: 4, avgEngagementPerPost: 5 },
    byPlatform: [{ platform: "Facebook", total: 8, published: 5, failed: 1, likes: 20, comments: 3, shares: 2, views: 50, reach: 40 }],
    byDate: [{ date: "2026-10-01", planned: 2, published: 1, failed: 0, likes: 4, views: 10 }],
    qualityScores: { avgScore: 82, byDimension: { fidelity: 80, objective: 82, platform: 84, hook: 81, conversion: 79, readability: 85, novelty: 83 } },
    byPillar: [{ pillar: "SECRET PILLAR" }],
    byFunnel: [{ label: "SECRET FUNNEL" }],
    byMediaType: [{ label: "SECRET MEDIA" }],
    topErrors: [{ message: "SECRET ERROR" }],
    campaigns: [{ _id: campaignId, title: "Chiến dịch khác" }],
    posts: [{ postUrl: "https://private.example/post", postId: "PRIVATE_POST" }],
  } as any);
  return { findOne, campaignQuery, analytics };
}

afterEach(() => vi.restoreAllMocks());

describe("bounded assistant campaign analytics", () => {
  it("selects one company campaign, limits the date span, and returns only summary fields", async () => {
    const { findOne, campaignQuery, analytics } = setup();
    const result = await MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", filters);

    expect(findOne).toHaveBeenCalledWith({ _id: expect.anything(), companyCode: "ACME" });
    expect(campaignQuery.select).toHaveBeenCalledWith("title");
    expect(analytics).toHaveBeenCalledWith("ACME", { ...filters, assistantSummary: true });
    expect(result).toEqual({
      campaignTitle: "Chiến dịch tháng 10",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      platform: "Facebook",
      overview: { totalSlots: 8, publishedSlots: 5, failedSlots: 1, pendingApprovalSlots: 2, successRate: 63, totalAiCost: 3.5, avgAttemptCount: 1.25 },
      platformMetrics: { totalLikes: 20, totalComments: 3, totalShares: 2, totalViews: 50, totalReach: 40, totalImpressions: 70, totalClicks: 4, avgEngagementPerPost: 5 },
      byPlatform: [{ platform: "Facebook", total: 8, published: 5, failed: 1, likes: 20, comments: 3, shares: 2, views: 50, reach: 40 }],
      byDate: [{ date: "2026-10-01", planned: 2, published: 1, failed: 0, likes: 4, views: 10 }],
      qualityScores: { avgScore: 82, byDimension: { fidelity: 80, objective: 82, platform: 84, hook: 81, conversion: 79, readability: 85, novelty: 83 } },
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE|postUrl|postId|campaignId|_id/);
  });

  it("accepts a 31-day inclusive window and rejects wider or invalid windows before querying", async () => {
    const { findOne, analytics } = setup();
    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", filters)).resolves.toMatchObject({ startDate: filters.startDate, endDate: filters.endDate });
    expect(findOne).toHaveBeenCalledTimes(1);

    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", {
      ...filters, endDate: "2026-11-01",
    })).rejects.toThrow("tối đa 31 ngày");
    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", {
      ...filters, startDate: "2026-02-30",
    })).rejects.toThrow("Khoảng ngày cần hợp lệ");
    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", {
      ...filters, startDate: "2026-11-01", endDate: "2026-10-31",
    })).rejects.toThrow("Khoảng ngày cần hợp lệ");
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(analytics).toHaveBeenCalledTimes(1);
  });

  it("requires a valid selected campaign and supported platform", async () => {
    const { findOne, analytics } = setup();
    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", { ...filters, campaignId: "not-an-id" }))
      .rejects.toThrow("chọn một chiến dịch trong danh sách theo tên");
    await expect(MarketingAnalyticsService.getAssistantCampaignAnalytics("ACME", { ...filters, platform: "Instagram" }))
      .rejects.toThrow("Kênh cần là Facebook hoặc TikTok");
    expect(findOne).not.toHaveBeenCalled();
    expect(analytics).not.toHaveBeenCalled();
  });

  it("limits summary-mode database reads to the selected campaign and skips detail/error collections", async () => {
    const selectedId = new Types.ObjectId(campaignId);
    const campaignFilters: unknown[] = [];
    const campaignQuery = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: selectedId, title: "Chiến dịch tháng 10", timezone: "Asia/Ho_Chi_Minh" }]),
    };
    const campaignFind = vi.spyOn(MarketingCampaignModel, "find").mockImplementation(((filter: unknown) => {
      campaignFilters.push(filter);
      return campaignQuery as any;
    }) as any);
    const slotAggregate = vi.spyOn(MarketingCampaignSlotModel, "aggregate").mockResolvedValue([] as any);
    const slotFindQuery = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) };
    const slotFind = vi.spyOn(MarketingCampaignSlotModel, "find").mockReturnValue(slotFindQuery as any);
    const metricAggregate = vi.spyOn(SocialPostMetricModel, "aggregate").mockResolvedValue([] as any);

    await MarketingAnalyticsService.getCampaignAnalytics("ACME", {
      ...filters, assistantSummary: true,
    });

    expect(campaignFind).toHaveBeenCalledTimes(2);
    expect(campaignFilters[0]).toEqual({ companyCode: "ACME", _id: campaignId });
    expect(campaignFilters[1]).toMatchObject({ companyCode: "ACME", _id: expect.any(Types.ObjectId) });
    expect(slotFind).toHaveBeenCalledTimes(1);
    expect(slotAggregate).toHaveBeenCalledTimes(4);
    expect(metricAggregate).toHaveBeenCalledTimes(1);
  });
});
