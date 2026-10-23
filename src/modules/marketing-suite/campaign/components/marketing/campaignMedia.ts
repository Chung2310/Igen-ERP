export const CAMPAIGN_MEDIA_EVENT = "marketing:campaign-media";

export interface CampaignMediaLaunch {
  kind: "image" | "video" | "voice" | "bulk";
  cardId?: string;
  campaignId?: string;
  prompt?: string;
  image?: string;
  autoTrigger?: boolean;
  title?: string;
  description?: string;
}

export function openCampaignMedia(launch: CampaignMediaLaunch) {
  if (launch.kind === "bulk" ? !launch.campaignId && !launch.cardId : !launch.cardId) return;
  window.dispatchEvent(new CustomEvent<CampaignMediaLaunch>(CAMPAIGN_MEDIA_EVENT, { detail: launch }));
}
