import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";

type AssistantCampaignListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

const summaryFields = "_id title campaignType status startDate endDate postsPerDay createdAt";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return undefined;
}

export async function listAssistantCampaignSummaries(companyCode: string, query: AssistantCampaignListQuery = {}) {
  const page = Math.max(1, Math.min(100, Math.floor(Number(query.page) || 1)));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit) || 10)));
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const filter = {
    companyCode,
    ...(search ? { title: { $regex: escapeRegex(search), $options: "i" } } : {}),
  };
  const fetchedRows = await MarketingCampaignModel.find(filter)
    .select(summaryFields)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean();
  const hasMore = fetchedRows.length > limit;
  const rows = fetchedRows.slice(0, limit);

  const campaigns = rows.map((row: any) => ({
    _id: String(row._id || row.id || ""),
    ...(typeof row.title === "string" ? { title: row.title } : {}),
    ...(typeof row.campaignType === "string" ? { campaignType: row.campaignType } : {}),
    ...(typeof row.status === "string" ? { status: row.status } : {}),
    ...(typeof row.startDate === "string" ? { startDate: row.startDate } : {}),
    ...(typeof row.endDate === "string" ? { endDate: row.endDate } : {}),
    ...(Number.isSafeInteger(row.postsPerDay) ? { postsPerDay: row.postsPerDay } : {}),
    ...(dateString(row.createdAt) ? { createdAt: dateString(row.createdAt) } : {}),
  }));

  return {
    campaigns,
    pagination: { page, limit, hasMore },
  };
}
