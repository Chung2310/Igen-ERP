import { leadDestinationPlatforms, leadModuleTargets, type LeadDestinationChannel, type LeadDestinationPlatform, type LeadDestinationSettings, type LeadModuleDestination } from "../../../../../shared/marketing-suite/lead-module-destination";
import type { LeadTargetModule } from "../../../../../shared/marketing-suite/lead-intake";
import { getModuleStateForCompany, isServiceSubscriptionBlocked, resolveModuleAccess } from "../../../../middleware/require-module";
import { UserModel } from "../../../../model/user.model";
import { assertMarketingAccountOwnership } from "../../shared/account-ownership";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadModuleDestinationModel } from "../model/lead-module-destination.model";
import { canProcessMessengerWebhook } from "../webhook-access";

const channelInfo = {
  facebook: { provider: "Facebook", id: "facebookIntegration.pageId", connected: "facebookIntegration.isConnected" },
  zalo: { provider: "Zalo", id: "zaloIntegration.oaId", connected: "zaloIntegration.isConnected" },
} as const;

function isDestinationPlatform(value: unknown): value is LeadDestinationPlatform {
  return leadDestinationPlatforms.some(platform => platform === value);
}

function isTargetModule(value: unknown): value is LeadTargetModule {
  return leadModuleTargets.some(target => target.value === value);
}

async function availableLeadModules(companyCode: string): Promise<LeadTargetModule[]> {
  const state = await getModuleStateForCompany(companyCode);
  if (isServiceSubscriptionBlocked(state)) return [];
  return leadModuleTargets
    .filter(({ moduleKey }) => resolveModuleAccess({ companyCode }, moduleKey, state.modules, state.exists, state.businessType))
    .map(({ value }) => value);
}

export async function readLeadDestinationSettings(companyCode: string): Promise<LeadDestinationSettings> {
  const [accounts, users, preferences, availableModules] = await Promise.all([
    SocialIntegrationModel.find({ companyCode, isConnected: true, platform: { $in: ["Facebook", "Zalo"] } })
      .select("platform username displayName").lean(),
    UserModel.find({ companyCode, disabledAt: null, $or: [
      { "facebookIntegration.isConnected": true }, { "zaloIntegration.isConnected": true },
    ] }).select("facebookIntegration.pageId facebookIntegration.pageName facebookIntegration.isConnected zaloIntegration.oaId zaloIntegration.oaName zaloIntegration.isConnected").lean(),
    LeadModuleDestinationModel.find({ companyCode }).select("platform accountId targetModule").lean(),
    availableLeadModules(companyCode),
  ]);
  const byChannel = new Map(preferences.map(preference => [`${preference.platform}:${preference.accountId}`, preference.targetModule]));
  const channels = new Map<string, LeadDestinationChannel>();
  function addChannel(platform: LeadDestinationPlatform, accountId?: string, name?: string) {
    if (!accountId?.trim()) return;
    const key = `${platform}:${accountId}`;
    const saved = byChannel.get(key);
    if (!channels.has(key)) channels.set(key, {
      platform, accountId, displayName: name?.trim() || accountId, targetModule: isTargetModule(saved) ? saved : null,
    });
  }
  for (const account of accounts) addChannel(account.platform === "Facebook" ? "facebook" : "zalo", account.username, account.displayName);
  for (const user of users) {
    const { facebookIntegration, zaloIntegration } = user;
    if (facebookIntegration?.isConnected) addChannel("facebook", facebookIntegration.pageId, facebookIntegration.pageName);
    if (zaloIntegration?.isConnected) addChannel("zalo", zaloIntegration.oaId, zaloIntegration.oaName);
  }
  return { availableModules, channels: [...channels.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "vi")) };
}

export async function saveLeadDestination(companyCode: string, input: { platform?: unknown; accountId?: unknown; targetModule?: unknown }) {
  const { platform } = input;
  const targetModule = isTargetModule(input.targetModule) ? input.targetModule : null;
  const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
  if (!isDestinationPlatform(platform) || !accountId || accountId.length > 200 || (targetModule === null && input.targetModule !== null)) {
    throw Object.assign(new Error("Cấu hình phân hệ nhận Lead không hợp lệ."), { statusCode: 400 });
  }
  const channel = channelInfo[platform];
  const [companyAccount, personalAccount] = await Promise.all([
    SocialIntegrationModel.exists({ companyCode, platform: channel.provider, username: accountId, isConnected: true }),
    UserModel.exists({ companyCode, disabledAt: null, [channel.id]: accountId, [channel.connected]: true }),
  ]);
  if (!companyAccount && !personalAccount) {
    throw Object.assign(new Error("Không tìm thấy kênh đang kết nối của doanh nghiệp."), { statusCode: 404 });
  }
  await assertMarketingAccountOwnership(companyCode, channel.provider, accountId);
  const scope = { companyCode, platform, accountId };
  if (targetModule === null) {
    await LeadModuleDestinationModel.deleteOne(scope);
  } else {
    if (!(await availableLeadModules(companyCode)).includes(targetModule)) {
      throw Object.assign(new Error("Phân hệ nhận Lead chưa được bật cho doanh nghiệp."), { statusCode: 400 });
    }
    await LeadModuleDestinationModel.updateOne(scope, { $set: { targetModule } }, { upsert: true, runValidators: true });
  }
  return { targetModule };
}

export async function resolveLeadDestination(companyCode: string, leadId: string): Promise<LeadModuleDestination | null> {
  const lead = await CRMTicketModel.findOne({ _id: leadId, companyCode }).select("sourcePlatform sourceAccountId").lean();
  if (!lead) return null;
  const availableModules = await availableLeadModules(companyCode);
  const { sourcePlatform, sourceAccountId } = lead;
  if (!isDestinationPlatform(sourcePlatform) || !sourceAccountId || !availableModules.length) return { targetModule: null, availableModules };
  const saved = await LeadModuleDestinationModel.findOne({ companyCode, platform: sourcePlatform, accountId: sourceAccountId })
    .select("targetModule").lean();
  const targetModule = saved?.targetModule;
  if (!isTargetModule(targetModule) || !availableModules.includes(targetModule)
    || !await canProcessMessengerWebhook(channelInfo[sourcePlatform].provider, sourceAccountId, companyCode)) {
    return { targetModule: null, availableModules };
  }
  return { targetModule, availableModules };
}
