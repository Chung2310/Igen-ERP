import { MarketingCampaignSlotModel } from "./model/marketing-campaign-slot.model";
import { MarketingCampaignModel } from "./model/marketing-campaign.model";
import { companyModuleEnabled } from "../shared/access";
import { SocialIntegrationModel } from "../shared/model/social-integration.model";

export async function guardCampaignSlot(slotId: string, lockId: string) {
  const slot = await MarketingCampaignSlotModel.findOne({ _id: slotId, lockId }).lean();
  if (!slot) return false;
  const campaign = await MarketingCampaignModel.findOne({ _id: slot.campaignId, companyCode: slot.companyCode }).select("status").lean();
  if (campaign?.status !== "active") {
    await MarketingCampaignSlotModel.updateOne({ _id: slotId, companyCode: slot.companyCode, lockId }, {
      $set: { lockId: null, lockedAt: null, lockExpiresAt: null, ...(campaign?.status === "paused" ? {} : { status: "cancelled" }) },
    });
    return false;
  }
  const enabled = await companyModuleEnabled(slot.companyCode, "social-marketing");
  const account = !slot.integrationId || await SocialIntegrationModel.exists({ _id: slot.integrationId, companyCode: slot.companyCode, isConnected: true });
  if (enabled && account) return true;
  await MarketingCampaignSlotModel.updateOne({ _id: slotId, lockId }, {
    $set: { status: "needs_attention", lastError: { type: "authentication", message: "Phân hệ hoặc tài khoản đã ngừng hoạt động.", occurredAt: new Date() } },
    $unset: { lockId: "", lockedAt: "", lockExpiresAt: "" },
    $push: { transitions: { from: slot.status, to: "needs_attention", reason: "Module/account access revoked.", at: new Date() } },
  });
  return false;
}
