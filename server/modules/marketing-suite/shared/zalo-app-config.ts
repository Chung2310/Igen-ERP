import { SocialIntegrationModel } from "./model/social-integration.model";
import { UserModel } from "../../../model/user.model";
import { assertMarketingAccountOwnership } from "./account-ownership";
import { verifyZaloWebhook } from "../message/webhook-signature";

export type ZaloAppCredentials = { mode: "default" | "custom"; appId: string; appSecret: string; webhookSecret: string };
export function zaloConfigError(message: string, statusCode = 409) { return Object.assign(new Error(message), { statusCode }); }
export function zaloCredentialsForIntegration(integration?: {
  zaloAppMode?: string; zaloAppId?: string; zaloAppSecret?: string; zaloWebhookSecret?: string; zaloTokenAppId?: string;
}): ZaloAppCredentials {
  const custom = integration?.zaloAppMode === "custom";
  const config: ZaloAppCredentials = {
    mode: custom ? "custom" : "default",
    appId: (custom ? integration.zaloAppId : process.env.ZALO_APP_ID)?.trim() || "",
    appSecret: (custom ? integration.zaloAppSecret : process.env.ZALO_APP_SECRET)?.trim() || "",
    webhookSecret: (custom ? integration.zaloWebhookSecret : process.env.ZALO_OA_SECRET_KEY)?.trim() || "",
  };
  if (!config.appId || !config.appSecret) throw zaloConfigError("Chưa cấu hình đủ App Zalo cho kết nối OA.");
  if (custom && !config.webhookSecret) throw zaloConfigError("Chưa cấu hình khóa webhook của App riêng.");
  if (integration?.zaloTokenAppId && integration.zaloTokenAppId !== config.appId) throw zaloConfigError("Token OA thuộc App khác. Hãy kết nối lại OA với App đã chọn.");
  return config;
}

export async function resolveZaloAppConfig(oaId: string, companyCode?: string) {
  if (!/^\d{1,30}$/.test(oaId)) throw zaloConfigError("OA không hợp lệ.", 400);
  const account = await SocialIntegrationModel.findOne({ platform: "Zalo", username: oaId, ...(companyCode ? { companyCode } : {}) })
    .sort({ isConnected: -1 }).lean();
  if (account) {
    await assertMarketingAccountOwnership(account.companyCode, "Zalo", oaId);
    if (!account.isConnected || account.isMock) throw zaloConfigError("OA chưa kết nối thật với doanh nghiệp.", 403);
    return { ...zaloCredentialsForIntegration(account), companyCode: account.companyCode, integrationId: String(account._id) };
  }
  const user = await UserModel.findOne({ ...(companyCode ? { companyCode } : {}), disabledAt: null,
    "zaloIntegration.oaId": oaId, "zaloIntegration.isConnected": true, "zaloIntegration.isMock": { $ne: true } }).select("companyCode").lean();
  if (!user?.companyCode) throw zaloConfigError("OA chưa kết nối với doanh nghiệp.", 403);
  await assertMarketingAccountOwnership(user.companyCode, "Zalo", oaId);
  return { ...zaloCredentialsForIntegration(), companyCode: user.companyCode, integrationId: undefined };
}

/** Only accept a signature for the exact OA/App binding, before dispatching any webhook. */
export async function verifyZaloConnectionWebhook(input: {
  body: { app_id?: unknown; event_name?: unknown; oa_id?: unknown; sender?: { id?: unknown }; recipient?: { id?: unknown }; timestamp?: string | number };
  signature?: string; rawBody?: string;
}) {
  const body = input.body;
  const event = String(body.event_name || "");
  const outbound = event.startsWith("oa_send_") || ["user_received_message", "user_seen_message"].includes(event);
  const directionalOa = String((outbound ? body.sender?.id : body.recipient?.id) || "");
  if (body.oa_id && directionalOa && String(body.oa_id) !== directionalOa) return null;
  const oaId = String(body.oa_id || directionalOa);
  try {
    const config = await resolveZaloAppConfig(oaId);
    return verifyZaloWebhook({ signature: input.signature, rawBody: input.rawBody, appId: String(body.app_id || ""),
      timestamp: body.timestamp, expectedAppId: config.appId, secret: config.webhookSecret }) ? { oaId, appId: config.appId, companyCode: config.companyCode } : null;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) return null;
    throw error; // Database/key failures must be retried rather than acknowledged as valid events.
  }
}
