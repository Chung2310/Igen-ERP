import { isObjectIdOrHexString } from "mongoose";
import type { ZaloLeadIdentity } from "../../../../../shared/marketing-suite/lead-intake";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { ZaloConversationModel } from "../model/zalo-messenger.model";

type LeadSource = { sourcePlatform?: string; sourceAccountId?: string; sourceConversationId?: string };
type ZaloSource = { sourcePlatform: "zalo"; sourceAccountId: string; sourceConversationId: string };

export async function withLeadZaloIdentities<T extends LeadSource>(companyCode: string, leads: T[]): Promise<Array<T & { zaloIdentity?: ZaloLeadIdentity }>> {
  const sources = leads.filter((lead): lead is T & ZaloSource => lead.sourcePlatform === "zalo"
    && Boolean(lead.sourceAccountId) && typeof lead.sourceConversationId === "string" && isObjectIdOrHexString(lead.sourceConversationId));
  if (!sources.length) return leads;
  const accountIds = [...new Set(sources.map(lead => lead.sourceAccountId))];
  const [accounts, users] = await Promise.all([
    SocialIntegrationModel.find({ platform: "Zalo", username: { $in: accountIds }, isConnected: true })
      .select("username companyCode").lean(),
    UserModel.find({ "zaloIntegration.oaId": { $in: accountIds }, "zaloIntegration.isConnected": true, disabledAt: null })
      .select("zaloIntegration.oaId companyCode").lean(),
  ]);
  const owners = [
    ...accounts.map(account => ({ oaId: account.username, companyCode: account.companyCode })),
    ...users.map(user => ({ oaId: user.zaloIntegration?.oaId, companyCode: user.companyCode })),
  ];
  const owned = new Set(owners.filter(owner => owner.companyCode === companyCode).map(owner => owner.oaId));
  const conflicting = new Set(owners.filter(owner => owner.companyCode !== companyCode).map(owner => owner.oaId));
  const ownedSources = sources.filter(lead => owned.has(lead.sourceAccountId) && !conflicting.has(lead.sourceAccountId));
  if (!ownedSources.length) return leads;

  const conversations = await ZaloConversationModel.find({
    _id: { $in: ownedSources.map(lead => lead.sourceConversationId) },
    oaId: { $in: [...new Set(ownedSources.map(lead => lead.sourceAccountId))] },
  }).select("oaId recipientId").lean();
  const identities = new Map(conversations.flatMap(conversation => conversation.recipientId
    ? [[String(conversation._id), { oaId: conversation.oaId, uid: conversation.recipientId }] as const] : []));
  return leads.map(lead => {
    const identity = lead.sourcePlatform === "zalo" && lead.sourceConversationId
      ? identities.get(lead.sourceConversationId.toLowerCase()) : undefined;
    return identity && identity.oaId === lead.sourceAccountId ? { ...lead, zaloIdentity: identity } : lead;
  });
}
