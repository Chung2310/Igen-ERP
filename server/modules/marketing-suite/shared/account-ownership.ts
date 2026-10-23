import { UserModel } from "../../../model/user.model";
import { SocialIntegrationModel } from "./model/social-integration.model";

export async function assertMarketingAccountOwnership(companyCode: string, platform: string, accountId: string) {
  if (platform !== "Facebook" && platform !== "Zalo" && platform !== "TikTok") throw Object.assign(new Error("Nền tảng không hợp lệ."), { status: 400, statusCode: 400 });
  const field = platform === "Facebook" ? "facebookIntegration.pageId" : platform === "Zalo" ? "zaloIntegration.oaId" : "tiktokIntegration.username";
  const enabled = platform === "Facebook" ? "facebookIntegration.isConnected" : platform === "Zalo" ? "zaloIntegration.isConnected" : "tiktokIntegration.isConnected";
  const [companyAccount, personalAccount] = await Promise.all([
    SocialIntegrationModel.exists({ companyCode: { $ne: companyCode }, platform, username: accountId, isConnected: true }),
    UserModel.exists({ companyCode: { $ne: companyCode }, [field]: accountId, [enabled]: true }),
  ]);
  if (companyAccount || personalAccount) throw Object.assign(new Error("Tài khoản mạng xã hội đang thuộc một doanh nghiệp khác."), { status: 409, statusCode: 409 });
}
