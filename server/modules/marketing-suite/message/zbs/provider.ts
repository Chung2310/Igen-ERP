import type { ZbsTemplate, ZbsRow } from "../../../../../shared/marketing-suite/zbs";
import { assertMarketingAccountOwnership } from "../../shared/account-ownership";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { UserModel } from "../../../../model/user.model";
import { zaloMessengerService } from "../service/zalo-messenger.service";
import { zbsError } from "./core";
import { resolveZaloAppConfig } from "../../shared/zalo-app-config";

export async function assertZbsOa(companyCode: string, oaId: string) {
  if (!/^\d{1,30}$/.test(oaId)) throw zbsError("OA không hợp lệ.");
  await assertMarketingAccountOwnership(companyCode, "Zalo", oaId);
  const account = await SocialIntegrationModel.findOne({ companyCode, platform: "Zalo", username: oaId, isConnected: true }).select("isMock").lean();
  if (account) { if (account.isMock) throw zbsError("Hãy kết nối OA thật để sử dụng ZBS."); return; }
  const user = await UserModel.findOne({ companyCode, disabledAt: null, "zaloIntegration.oaId": oaId, "zaloIntegration.isConnected": true }).select("zaloIntegration.isMock").lean();
  if (!user || user.zaloIntegration?.isMock) throw zbsError("OA chưa kết nối với doanh nghiệp.", 403);
}

export async function zbsProviderRequest(companyCode: string, oaId: string, path: string, body?: object, uid = false, expectedAppId?: string): Promise<Record<string, any>> {
  await assertZbsOa(companyCode, oaId);
  const config = await resolveZaloAppConfig(oaId, companyCode);
  if (expectedAppId && expectedAppId !== config.appId) throw zbsError("App của OA đã thay đổi. Hãy tạo bản xem trước mới với App hiện tại.", 409);
  const token = await zaloMessengerService.getAccessTokenByOAId(oaId, companyCode);
  if (!token) throw zbsError("Kết nối OA hết hạn. Hãy kết nối lại OA.", 409);
  if ((await resolveZaloAppConfig(oaId, companyCode)).appId !== config.appId) throw zbsError("App của OA vừa thay đổi. Hãy kiểm tra lại kết nối.", 409);
  const response = await fetch((uid ? "https://openapi.zalo.me" : "https://business.openapi.zalo.me") + path, {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", access_token: token },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  // A transport error or an invalid response does not establish that Zalo rejected a send.
  if (!response.ok) throw zbsError("Chưa xác định được kết quả từ Zalo. Cần đối soát trước khi gửi lại.", 502);
  const result = await response.json();
  if (typeof result?.error !== "number") throw zbsError("Phản hồi Zalo không hợp lệ; cần đối soát.", 502);
  if (result.error !== 0) throw Object.assign(zbsError(`Zalo từ chối yêu cầu (mã ${result.error}). Kiểm tra quyền OA, mẫu, dữ liệu, số dư và hạn mức.`, 422), { providerCode: result.error });
  return result;
}

const price = (value: unknown) => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export function normalizeZbsTemplate(raw: Record<string, any>): ZbsTemplate {
  if (raw?.templateId == null || !Array.isArray(raw.listParams) || raw.listParams.length > 100 ||
    raw.listParams.some((p: Record<string, unknown>) => !p || typeof p.name !== "string" || !/^[A-Za-z0-9_]{1,100}$/.test(p.name) || ["__proto__", "constructor", "prototype"].includes(p.name))) throw zbsError("Zalo chưa trả đủ thông tin mẫu hợp lệ.", 502);
  return {
    templateId: String(raw.templateId), name: String(raw.templateName || raw.templateId), status: String(raw.status || "UNKNOWN"),
    params: raw.listParams.map((p: Record<string, any>) => ({
      name: String(p.name), required: p.require !== false, type: String(p.type || "STRING"),
      minLength: Math.max(0, Number(p.minLength) || 0), maxLength: Math.min(2000, Number(p.maxLength) || 2000), acceptNull: p.acceptNull === true,
    })),
    buttons: (Array.isArray(raw.listButtons) ? raw.listButtons : []).map((b: Record<string, any>) => ({ title: String(b.title || ""), content: String(b.content || ""), type: Number(b.type) })),
    previewUrl: /^https:\/\/(account\.zalo\.(cloud|solutions))\//.test(raw.previewUrl || "") ? raw.previewUrl : "",
    // Missing UID pricing is treated as unknown support, never guessed from approval alone.
    uidSupported: price(raw.price_uid) !== null, phoneSupported: price(raw.price_sdt ?? raw.price) !== null,
    priceUid: price(raw.price_uid), pricePhone: price(raw.price_sdt ?? raw.price), mapping: {},
  };
}
export async function fetchZbsTemplate(companyCode: string, oaId: string, templateId: string, expectedAppId?: string) {
  const result = await zbsProviderRequest(companyCode, oaId, `/template/info/v2?template_id=${encodeURIComponent(templateId)}`, undefined, false, expectedAppId);
  const template = normalizeZbsTemplate(result.data);
  if (template.templateId !== templateId) throw zbsError("Zalo trả về sai mẫu.", 502);
  return template;
}
export async function sendZbsRow(companyCode: string, oaId: string, templateId: string, row: ZbsRow, development: boolean, expectedAppId?: string) {
  return zbsProviderRequest(companyCode, oaId,
    row.method === "uid" ? "/v3.0/oa/message/template" : "/message/template", {
      template_id: templateId, template_data: row.data,
      ...(row.method === "uid" ? { user_id: row.recipient } : { phone: row.recipient, tracking_id: row.trackingId, ...(development ? { mode: "development" } : {}) }),
    }, row.method === "uid", expectedAppId);
}
