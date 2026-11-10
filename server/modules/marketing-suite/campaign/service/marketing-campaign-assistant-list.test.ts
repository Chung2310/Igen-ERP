import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("../model/marketing-campaign.model.ts", () => ({
  MarketingCampaignModel: { find: mocks.find },
}));

import { listAssistantCampaignSummaries } from "./marketing-campaign-assistant-list.service";

describe("listAssistantCampaignSummaries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a company-scoped escaped title filter and returns only safe summary fields", async () => {
    const query = {
      select: vi.fn(), sort: vi.fn(), skip: vi.fn(), limit: vi.fn(), lean: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.lean.mockResolvedValue([{
      _id: "507f1f77bcf86cd799439999", title: "C++ [b] mùa hè", campaignType: "campaign", status: "active",
      startDate: "2026-11-01", endDate: "2026-11-30", postsPerDay: 2, createdAt: new Date("2026-10-30T00:00:00.000Z"),
      sourceBrief: "PRIVATE", integrationIds: { Facebook: "PRIVATE" }, statistics: { actualCost: 999 },
    }]);
    mocks.find.mockReturnValue(query);
    const result = await listAssistantCampaignSummaries("ACME", { search: "C++ [b]", page: 2, limit: 20 });

    expect(mocks.find).toHaveBeenCalledWith({ companyCode: "ACME", title: { $regex: "C\\+\\+ \\[b\\]", $options: "i" } });
    expect(query.select).toHaveBeenCalledWith("_id title campaignType status startDate endDate postsPerDay createdAt");
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(21);
    expect(result).toEqual({
      campaigns: [{
        _id: "507f1f77bcf86cd799439999", title: "C++ [b] mùa hè", campaignType: "campaign", status: "active",
        startDate: "2026-11-01", endDate: "2026-11-30", postsPerDay: 2, createdAt: "2026-10-30T00:00:00.000Z",
      }],
      pagination: { page: 2, limit: 20, hasMore: false },
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|actualCost|integrationIds/);
  });

  it("clamps the page size to 100 and defaults an empty search to company-only scope", async () => {
    const query = {
      select: vi.fn(), sort: vi.fn(), skip: vi.fn(), limit: vi.fn(), lean: vi.fn().mockResolvedValue([]),
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    mocks.find.mockReturnValue(query);
    await listAssistantCampaignSummaries("ACME", { page: 0, limit: 500, search: "  " });

    expect(mocks.find).toHaveBeenCalledWith({ companyCode: "ACME" });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(101);
  });
});
