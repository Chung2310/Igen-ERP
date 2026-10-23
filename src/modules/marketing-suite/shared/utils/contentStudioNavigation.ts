import { openCampaignMedia } from '../../campaign/components/marketing/campaignMedia';

export interface ContentStudioLaunchParams {
  tab: 'image' | 'template';
  prompt?: string;
  cardId?: string;
  image?: string;
  autoTrigger?: boolean;
  campaignId?: string;
}

export function openContentStudio(params?: ContentStudioLaunchParams) {
  if (params) openCampaignMedia({ ...params, kind: params.tab === 'template' ? 'bulk' : 'image' });
}
