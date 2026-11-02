import { scanAndEnqueueDueSlots } from "./campaign-scheduler.service.ts";
import type { MarketingCampaignPlatform } from "../interface/marketing-campaign.interface.ts";

export const marketingCampaignWorkerService = {
  async prepareDueSlots(limit = 3, platform?: MarketingCampaignPlatform) {
    const queued = await scanAndEnqueueDueSlots({
      limit: Math.max(1, Math.min(limit, 10)),
      platform,
    });
    return {
      claimed: queued.enqueued,
      results: queued.slotIds.map((slotId) => ({ slotId, status: "queued" })),
      deferred: queued.deferred,
    };
  },
};
