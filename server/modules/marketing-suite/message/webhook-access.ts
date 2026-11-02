import { SocialIntegrationModel } from "../shared/model/social-integration.model";
import { UserModel } from "../../../model/user.model";
import { companyModuleEnabled } from "../shared/access";

// Refuse ambiguous legacy account ownership as well as disabled company modules.
export async function canProcessMessengerWebhook(platform: "Facebook" | "Zalo" | "TikTok", accountId: unknown) {
  if (typeof accountId !== "string" || !accountId.trim()) return false;
  const field = platform === "Facebook" ? "facebookIntegration.pageId" : platform === "Zalo" ? "zaloIntegration.oaId" : "tiktokIntegration.username";
  const enabled = platform === "Facebook" ? "facebookIntegration.isConnected" : platform === "Zalo" ? "zaloIntegration.isConnected" : "tiktokIntegration.isConnected";
  const [accounts, users] = await Promise.all([
    SocialIntegrationModel.find({ platform, username: accountId, isConnected: true }).select("companyCode").lean(),
    UserModel.find({ [field]: accountId, [enabled]: true, disabledAt: null }).select("companyCode").lean(),
  ]);
  const companies = [...new Set([...accounts, ...users].map((record) => record.companyCode).filter((code): code is string => Boolean(code)))];
  return companies.length === 1 && await companyModuleEnabled(companies[0], "omni-inbox");
}
