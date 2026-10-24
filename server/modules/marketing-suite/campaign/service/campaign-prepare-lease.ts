import type { IMarketingCampaignSlot } from "../interface/marketing-campaign-slot.interface";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { guardCampaignSlot } from "../worker-access";

const PREPARE_STATUSES = ["generating", "researching", "writing", "scoring"] as const;
const LEASE_MS = 20 * 60_000;
const lostLease = () => Object.assign(new Error("Worker chuẩn bị đã mất khóa slot."), { code: "CAMPAIGN_SLOT_LEASE_LOST" });

export function isPrepareLeaseLost(error: unknown) {
  return (error as { code?: string })?.code === "CAMPAIGN_SLOT_LEASE_LOST";
}

/** Fence every document save, including research/vision checkpoints, by its lease. */
export function createCampaignPrepareLease(slot: IMarketingCampaignSlot, lockId: string) {
  let lost = false;
  let renewing = false;
  const scope = () => ({
    _id: slot._id, companyCode: slot.companyCode, campaignId: slot.campaignId, lockId,
    status: { $in: PREPARE_STATUSES }, lockExpiresAt: { $gt: new Date() },
  });
  const assertActive = async () => {
    if (lost || !await guardCampaignSlot(String(slot._id), lockId) || !await MarketingCampaignSlotModel.exists(scope())) {
      lost = true;
      throw lostLease();
    }
  };
  const save = async () => {
    await assertActive();
    slot.$where = scope();
    try { await slot.save(); }
    catch (error) {
      if ((error as { name?: string })?.name === "DocumentNotFoundError") { lost = true; throw lostLease(); }
      throw error;
    }
  };
  const heartbeat = setInterval(() => {
    if (lost || renewing) return;
    renewing = true;
    void MarketingCampaignSlotModel.updateOne(scope(), { $set: { lockExpiresAt: new Date(Date.now() + LEASE_MS) } })
      .then(result => { if (!result.matchedCount) lost = true; })
      .catch(error => console.error("[Campaign prepare lease] Renewal failed:", error))
      .finally(() => { renewing = false; });
  }, 30_000);
  heartbeat.unref();
  return { assertActive, save, scope, stop: () => { lost = true; clearInterval(heartbeat); } };
}
