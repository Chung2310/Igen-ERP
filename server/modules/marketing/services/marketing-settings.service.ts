import { MarketingSettingsModel } from "../models/marketing-settings.model";
import { MARKETING_AUTOMATION_TYPES, MARKETING_CHANNELS, type MarketingAutomationType } from "../permissions";
import { DEFAULT_TEMPLATES, renderMarketingTemplate, emptyVariables } from "./marketing-template";

export type MarketingAutomationConfig = { enabled: boolean; channels: string[]; subject: string; html: string };
export type ResolvedMarketingSettings = {
  companyCode: string;
  timeZone: string;
  sendTime: string;
  remarketingInactiveDays: number;
  remarketingCooldownDays: number;
} & Record<MarketingAutomationType, MarketingAutomationConfig>;

function withDefaults(type: MarketingAutomationType, raw: any): MarketingAutomationConfig {
  const channels = Array.isArray(raw?.channels) ? raw.channels.filter((item: string) => (MARKETING_CHANNELS as readonly string[]).includes(item)) : [];
  return {
    enabled: Boolean(raw?.enabled),
    channels: channels.length ? channels : ["email"],
    subject: String(raw?.subject || "").trim() || DEFAULT_TEMPLATES[type].subject,
    html: String(raw?.html || "").trim() || DEFAULT_TEMPLATES[type].html,
  };
}

export function resolveMarketingSettings(companyCode: string, doc: any): ResolvedMarketingSettings {
  const base: any = {
    companyCode: companyCode.toUpperCase(),
    timeZone: String(doc?.timeZone || "Asia/Ho_Chi_Minh"),
    sendTime: /^\d{2}:\d{2}$/.test(String(doc?.sendTime)) ? String(doc.sendTime) : "08:00",
    remarketingInactiveDays: Number(doc?.remarketingInactiveDays) > 0 ? Number(doc.remarketingInactiveDays) : 90,
    remarketingCooldownDays: Number(doc?.remarketingCooldownDays) > 0 ? Number(doc.remarketingCooldownDays) : 180,
  };
  for (const type of MARKETING_AUTOMATION_TYPES) base[type] = withDefaults(type, doc?.[type]);
  return base as ResolvedMarketingSettings;
}

export async function getMarketingSettings(companyCode: string): Promise<ResolvedMarketingSettings> {
  const doc = await MarketingSettingsModel.findOne({ companyCode: companyCode.toUpperCase() }).lean();
  return resolveMarketingSettings(companyCode, doc);
}

/** Kiểm tra template trước khi lưu để lỗi biến hiện ngay trên màn hình cài đặt. */
export function assertTemplateValid(config: Partial<MarketingAutomationConfig>) {
  const sample = emptyVariables();
  if (config.subject !== undefined) renderMarketingTemplate(config.subject, sample);
  if (config.html !== undefined) renderMarketingTemplate(config.html, sample);
}

export async function saveMarketingSettings(companyCode: string, input: any, actorId: string) {
  const code = companyCode.toUpperCase();
  const update: any = { companyCode: code, updatedBy: actorId };
  if (input?.sendTime !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(String(input.sendTime))) throw new Error("MARKETING_INVALID_SEND_TIME");
    update.sendTime = String(input.sendTime);
  }
  if (input?.remarketingInactiveDays !== undefined) update.remarketingInactiveDays = Math.max(7, Number(input.remarketingInactiveDays) || 90);
  if (input?.remarketingCooldownDays !== undefined) update.remarketingCooldownDays = Math.max(7, Number(input.remarketingCooldownDays) || 180);
  for (const type of MARKETING_AUTOMATION_TYPES) {
    const config = input?.[type];
    if (!config) continue;
    assertTemplateValid(config);
    update[type] = withDefaults(type, config);
  }
  await MarketingSettingsModel.updateOne({ companyCode: code }, { $set: update }, { upsert: true });
  return getMarketingSettings(code);
}
