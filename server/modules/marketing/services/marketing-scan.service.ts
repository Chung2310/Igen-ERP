import { CompanyModel } from "../../../model/company.model";
import { getModuleStateForCompany, resolveModuleAccess } from "../../../middleware/require-module";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { MarketingCampaignModel } from "../models/marketing-campaign.model";
import { MarketingDeliveryModel } from "../models/marketing-delivery.model";
import { MarketingRunModel } from "../models/marketing-run.model";
import type { MarketingAutomationType } from "../permissions";
import { companyNameOf, queueAndSend, resolveSendableChannel } from "./marketing-delivery.service";
import { getMarketingSettings, type ResolvedMarketingSettings } from "./marketing-settings.service";
import { emptyVariables } from "./marketing-template";

export type ScanStats = { eligible: number; queued: number; skipped: number; failed: number; duplicates: number };
const emptyStats = (): ScanStats => ({ eligible: 0, queued: 0, skipped: 0, failed: 0, duplicates: 0 });

export function vietnamParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, month: get("month"), day: get("day"), time: `${get("hour")}:${get("minute")}` };
}

export const isSendTime = (now: Date, settings: Pick<ResolvedMarketingSettings, "timeZone" | "sendTime">) =>
  vietnamParts(now, settings.timeZone).time === settings.sendTime;

/** Khách hàng nhận tin marketing: hồ sơ đang hoạt động. */
const activeCustomerFilter = (companyCode: string): Record<string, unknown> => ({ companyCode: companyCode.toUpperCase(), status: "active" });

/** Hạng hiện tại của từng khách, đọc thẳng từ hồ sơ khách (module Bán lẻ ghi lại sau mỗi đơn). */
export async function currentTierMap(companyCode: string): Promise<Map<string, string>> {
  const rows = await CustomerModel.find({ companyCode: companyCode.toUpperCase(), "tier.code": { $exists: true } }).select("tier.code").lean();
  return new Map(rows.map((row: any) => [String(row._id), String(row.tier?.code || "")]));
}

/** Ngày mua gần nhất của từng khách (đơn đã xác nhận hoặc hoàn tất). */
export async function lastPurchaseMap(companyCode: string): Promise<Map<string, string>> {
  const rows = await RetailOrderModel.aggregate<{ _id: string; businessDate: string }>([
    { $match: { companyCode: companyCode.toUpperCase(), status: { $in: ["confirmed", "completed"] }, customerId: { $nin: [null, ""] } } },
    { $sort: { businessDate: -1 } },
    { $group: { _id: "$customerId", businessDate: { $first: "$businessDate" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), String(row.businessDate || "")]));
}

const daysBetween = (from: string, to: string) => {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
};

function applyOutcome(stats: ScanStats, status: string) {
  if (status === "sent") stats.queued += 1;
  else if (status === "duplicate") stats.duplicates += 1;
  else if (status === "skipped") stats.skipped += 1;
  else stats.failed += 1;
}

async function withRun(companyCode: string, automationType: MarketingAutomationType, businessDate: string, trigger: "scheduled" | "manual", actorId: string, body: (runId: string) => Promise<ScanStats>) {
  let run: any;
  try {
    run = await MarketingRunModel.create({
      companyCode: companyCode.toUpperCase(), automationType, businessDate,
      cycleKey: `${companyCode.toUpperCase()}:${automationType}:${businessDate}:${trigger}`,
      trigger, actorId, status: "running", startedAt: new Date(),
    });
  } catch (error: any) {
    if (error?.code === 11000) return emptyStats();
    throw error;
  }
  try {
    const stats = await body(String(run._id));
    await MarketingRunModel.updateOne({ _id: run._id }, { $set: { status: "completed", completedAt: new Date(), ...stats } });
    return stats;
  } catch (error: any) {
    await MarketingRunModel.updateOne({ _id: run._id }, { $set: { status: "failed", completedAt: new Date(), error: String(error?.message || error).slice(0, 500) } });
    throw error;
  }
}

export async function runBirthdayScan(companyCode: string, settings: ResolvedMarketingSettings, now: Date, trigger: "scheduled" | "manual" = "scheduled", actorId = "") {
  const local = vietnamParts(now, settings.timeZone);
  return withRun(companyCode, "birthday", local.date, trigger, actorId, async (runId) => {
    const stats = emptyStats();
    const adapter = await resolveSendableChannel(companyCode, settings.birthday.channels);
    const companyName = await companyNameOf(companyCode);
    const customers: any[] = await CustomerModel.find({ ...activeCustomerFilter(companyCode), dateOfBirth: { $ne: null } } as any).lean();
    for (const customer of customers) {
      const birth = customer.dateOfBirth ? new Date(customer.dateOfBirth) : undefined;
      if (!birth || Number.isNaN(birth.valueOf())) continue;
      const month = String(birth.getUTCMonth() + 1).padStart(2, "0");
      const day = String(birth.getUTCDate()).padStart(2, "0");
      if (month !== local.month || day !== local.day) continue;
      stats.eligible += 1;
      if (!adapter) { stats.skipped += 1; continue; }
      const outcome = await queueAndSend({
        companyCode, automationType: "birthday", runId, customer, adapter,
        variables: { ...emptyVariables(), customerName: String(customer.name || ""), companyName },
        idempotencyKey: `${companyCode.toUpperCase()}:birthday:${customer._id}:${local.date}:${adapter.channel}`,
        template: { subject: settings.birthday.subject, html: settings.birthday.html },
      });
      applyOutcome(stats, outcome.status);
    }
    return stats;
  });
}

export async function runHolidayScan(companyCode: string, settings: ResolvedMarketingSettings, now: Date, trigger: "scheduled" | "manual" = "scheduled", actorId = "") {
  const local = vietnamParts(now, settings.timeZone);
  return withRun(companyCode, "holiday", local.date, trigger, actorId, async (runId) => {
    const stats = emptyStats();
    const campaigns: any[] = await MarketingCampaignModel.find({ companyCode: companyCode.toUpperCase(), runDate: local.date, enabled: true }).lean();
    if (!campaigns.length) return stats;
    const companyName = await companyNameOf(companyCode);
    const tiers = await currentTierMap(companyCode);
    const customers: any[] = await CustomerModel.find(activeCustomerFilter(companyCode) as any).lean();
    for (const campaign of campaigns) {
      const adapter = await resolveSendableChannel(companyCode, campaign.channels?.length ? campaign.channels : settings.holiday.channels);
      const targets: string[] = Array.isArray(campaign.targetTierCodes) ? campaign.targetTierCodes : [];
      for (const customer of customers) {
        if (targets.length && !targets.includes(tiers.get(String(customer._id)) || "")) continue;
        stats.eligible += 1;
        if (!adapter) { stats.skipped += 1; continue; }
        const outcome = await queueAndSend({
          companyCode, automationType: "holiday", runId, campaignId: String(campaign._id), customer, adapter,
          variables: { ...emptyVariables(), customerName: String(customer.name || ""), companyName, holidayName: String(campaign.name || ""), campaignName: String(campaign.name || "") },
          idempotencyKey: `${companyCode.toUpperCase()}:holiday:${campaign._id}:${customer._id}:${adapter.channel}`,
          template: { subject: campaign.subject || settings.holiday.subject, html: campaign.html || settings.holiday.html },
        });
        applyOutcome(stats, outcome.status);
      }
    }
    return stats;
  });
}

export async function runRemarketingScan(companyCode: string, settings: ResolvedMarketingSettings, now: Date, trigger: "scheduled" | "manual" = "scheduled", actorId = "") {
  const local = vietnamParts(now, settings.timeZone);
  return withRun(companyCode, "remarketing", local.date, trigger, actorId, async (runId) => {
    const stats = emptyStats();
    const adapter = await resolveSendableChannel(companyCode, settings.remarketing.channels);
    const companyName = await companyNameOf(companyCode);
    const purchases = await lastPurchaseMap(companyCode);
    const cooldownSince = new Date(now.getTime() - settings.remarketingCooldownDays * 86_400_000);
    const customers: any[] = await CustomerModel.find(activeCustomerFilter(companyCode) as any).lean();
    for (const customer of customers) {
      const lastPurchase = purchases.get(String(customer._id)) || "";
      const inactiveDays = daysBetween(lastPurchase, local.date);
      if (!lastPurchase || inactiveDays < settings.remarketingInactiveDays) continue;
      const recent = await MarketingDeliveryModel.countDocuments({
        companyCode: companyCode.toUpperCase(), automationType: "remarketing",
        customerId: String(customer._id), status: "sent", createdAt: { $gte: cooldownSince },
      });
      if (recent > 0) continue;
      stats.eligible += 1;
      if (!adapter) { stats.skipped += 1; continue; }
      const outcome = await queueAndSend({
        companyCode, automationType: "remarketing", runId, customer, adapter,
        variables: { ...emptyVariables(), customerName: String(customer.name || ""), companyName, lastPurchaseDate: lastPurchase, inactiveDays: String(inactiveDays) },
        idempotencyKey: `${companyCode.toUpperCase()}:remarketing:${customer._id}:${local.date}:${adapter.channel}`,
        template: { subject: settings.remarketing.subject, html: settings.remarketing.html },
      });
      applyOutcome(stats, outcome.status);
    }
    return stats;
  });
}

export const MARKETING_SCANS = { birthday: runBirthdayScan, holiday: runHolidayScan, remarketing: runRemarketingScan } as const;
export type ScheduledScanType = keyof typeof MARKETING_SCANS;

async function marketingEnabled(companyCode: string) {
  const state = await getModuleStateForCompany(companyCode);
  return resolveModuleAccess({ companyCode } as any, "marketing", state.modules, state.exists, state.businessType);
}

/** Quét toàn hệ thống: mỗi công ty bật module marketing, đúng giờ gửi đã cấu hình. */
export async function runMarketingScheduledScans(now = new Date()) {
  const companies: any[] = await CompanyModel.find({ lifecycleStatus: "active" }).select("code").lean();
  let executed = 0;
  for (const company of companies) {
    const companyCode = String(company.code || "");
    if (!companyCode || !(await marketingEnabled(companyCode))) continue;
    const settings = await getMarketingSettings(companyCode);
    if (!isSendTime(now, settings)) continue;
    for (const type of ["birthday", "holiday", "remarketing"] as ScheduledScanType[]) {
      if (!settings[type].enabled) continue;
      try {
        await MARKETING_SCANS[type](companyCode, settings, now);
        executed += 1;
      } catch (error) {
        console.error(`[marketing-scan:${type}]`, companyCode, error);
      }
    }
  }
  return { executed };
}

export function startMarketingScheduler(intervalMs = 60_000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await runMarketingScheduledScans(); }
    catch (error) { console.error("[MarketingScheduler]", error); }
    finally { running = false; }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
