import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { AiUsageModel } from "../../shared/model/ai-subscription.model";
import { zonedLocalTimeToUtc } from "./marketing-campaign-schedule.service";
import { nextCalendarDate } from "./public-campaign-approval";

export async function campaignAnalyticsDateScope(companyCode: string, filters: { campaignId?: string; startDate?: string; endDate?: string }) {
  if (!filters.startDate && !filters.endDate) return {};
  if (filters.startDate) nextCalendarDate(filters.startDate);
  if (filters.endDate) nextCalendarDate(filters.endDate);
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error("Khoảng ngày không hợp lệ.");
  const campaigns = await MarketingCampaignModel.find({ companyCode, ...(filters.campaignId ? { _id: filters.campaignId } : {}) })
    .select("_id timezone").lean();
  const byTimezone = new Map<string, unknown[]>();
  for (const campaign of campaigns) {
    const timezone = campaign.timezone || "Asia/Ho_Chi_Minh";
    byTimezone.set(timezone, [...(byTimezone.get(timezone) || []), campaign._id]);
  }
  const groups = [...byTimezone].map(([timezone, ids]) => ({
    campaignId: { $in: ids },
    scheduledAt: {
      ...(filters.startDate ? { $gte: zonedLocalTimeToUtc(filters.startDate, "00:00", timezone) } : {}),
      ...(filters.endDate ? { $lt: zonedLocalTimeToUtc(nextCalendarDate(filters.endDate), "00:00", timezone) } : {}),
    },
  }));
  return groups.length ? { $or: groups } : { _id: { $in: [] } };
}

/** Successful AI calls only; historical credit amounts are not usage units. */
export function campaignSlotCostLookup() {
  return {
    $lookup: {
      from: AiUsageModel.collection.name,
      let: { slot: { $toString: "$_id" }, campaign: { $toString: "$campaignId" }, company: "$companyCode" },
      pipeline: [
        { $match: { status: "succeeded", $expr: { $and: [
          { $eq: ["$companyCode", "$$company"] }, { $eq: ["$campaignId", "$$campaign"] }, { $eq: ["$slotId", "$$slot"] },
        ] } } },
        { $group: { _id: null, amount: { $sum: "$units" } } },
      ],
      as: "walletCost",
    },
  };
}
