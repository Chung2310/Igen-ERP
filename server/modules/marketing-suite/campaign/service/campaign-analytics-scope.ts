import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { TransactionModel } from "../../../../model/transaction.model";
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

/** Sum successful wallet entries, including every candidate and image operation. */
export function campaignSlotCostLookup() {
  // Every namespace prefix ends in ':'. Use its range rather than scanning
  // strings with indexOfBytes, so the idempotency-key index can serve the lookup.
  const prefix = (parts: unknown[]) => ({ $and: [
    { $gte: ["$idempotencyKey", { $concat: parts }] },
    { $lt: ["$idempotencyKey", { $concat: [...parts.slice(0, -1), ";"] }] },
  ] });
  return {
    $lookup: {
      from: TransactionModel.collection.name,
      let: { slot: { $toString: "$_id" }, campaign: { $toString: "$campaignId" }, company: "$companyCode" },
      pipeline: [
        { $match: { type: "payment", status: "success", idempotencyKey: { $type: "string" } } },
        { $match: { $expr: { $or: [
          prefix(["$$campaign", ":", "$$slot", ":"]),
          prefix(["erp-candidate:", "$$company", ":", "$$slot", ":"]),
          // Aggregation strings beginning with '$' are field references unless literal.
          { $and: [prefix(["campaign-sheet-ai:", "$$company", ":"]), { $regexMatch: { input: "$idempotencyKey", regex: { $concat: [":", "$$slot", { $literal: "$" }] } } }] },
        ] } } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ],
      as: "walletCost",
    },
  };
}
