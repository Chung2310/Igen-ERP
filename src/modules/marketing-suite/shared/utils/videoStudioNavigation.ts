import { openCampaignMedia } from '../../campaign/components/marketing/campaignMedia';

export type VideoStudioTool = "upload-video" | "voice";

export interface VideoStudioLaunchParams {
  tool: VideoStudioTool;
  prompt?: string;
  cardId?: string;
  image?: string;
  autoTrigger?: boolean;
  title?: string;
  description?: string;
}

export function openVideoStudio(params?: VideoStudioLaunchParams) {
  if (!params) return;
  const kind = params.tool === "upload-video" ? "video" : params.tool;
  if (kind === "video" || kind === "voice") openCampaignMedia({ ...params, kind });
}
