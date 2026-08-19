import type { NextFunction, Request, Response } from "express";
import { MARKETING_CHANNEL_ADAPTERS } from "../services/marketing-channels";
import { MarketingCampaignModel } from "../models/marketing-campaign.model";
import { MarketingDeliveryModel } from "../models/marketing-delivery.model";
import { MarketingRunModel } from "../models/marketing-run.model";
import { getMarketingSettings, saveMarketingSettings } from "../services/marketing-settings.service";
import { companyNameOf, queueAndSend, resolveSendableChannel, retryDelivery } from "../services/marketing-delivery.service";
import { emptyVariables, DEFAULT_TEMPLATES, MARKETING_VARIABLE_KEYS } from "../services/marketing-template";
import { MARKETING_SCANS, type ScheduledScanType } from "../services/marketing-scan.service";
import { MARKETING_AUTOMATION_TYPES } from "../permissions";

function scopeOf(req: Request) {
  const user = (req as any).user || {};
  const raw = user.role === "superadmin" ? req.query.companyCode || user.companyCode : user.companyCode;
  const companyCode = String(raw || "").trim().toUpperCase();
  if (!companyCode) throw Object.assign(new Error("Phạm vi công ty là bắt buộc."), { status: 400, code: "MARKETING_COMPANY_REQUIRED" });
  return { companyCode, actorId: String(user.id || user.uid || "") };
}

const handle = (action: (req: Request, res: Response) => Promise<Response>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    return await action(req, res);
  } catch (error: any) {
    const status = Number(error?.status) || (String(error?.message || "").startsWith("MARKETING_") ? 400 : 0);
    if (status) return res.status(status).json({ success: false, code: error.code || error.message, message: error.message });
    return next(error);
  }
};

const ok = (res: Response, data: unknown) => res.json({ success: true, data });

export const marketingController = {
  getSettings: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const settings = await getMarketingSettings(companyCode);
    const channels = await Promise.all(Object.values(MARKETING_CHANNEL_ADAPTERS).map(async (adapter) => ({
      channel: adapter.channel,
      label: adapter.label,
      implemented: adapter.implemented,
      configured: adapter.implemented ? await adapter.isConfigured(companyCode) : false,
    })));
    return ok(res, { settings, channels, variables: MARKETING_VARIABLE_KEYS, defaults: DEFAULT_TEMPLATES });
  }),

  updateSettings: handle(async (req, res) => {
    const { companyCode, actorId } = scopeOf(req);
    return ok(res, await saveMarketingSettings(companyCode, req.body, actorId));
  }),

  listCampaigns: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const campaigns = await MarketingCampaignModel.find({ companyCode }).sort({ runDate: -1 }).limit(100).lean();
    return ok(res, campaigns);
  }),

  createCampaign: handle(async (req, res) => {
    const { companyCode, actorId } = scopeOf(req);
    const campaign = await MarketingCampaignModel.create({ ...req.body, companyCode, createdBy: actorId });
    return ok(res, campaign.toObject());
  }),

  updateCampaign: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const { companyCode: _ignored, ...values } = req.body || {};
    const campaign = await MarketingCampaignModel.findOneAndUpdate({ _id: req.params.id, companyCode }, { $set: values }, { new: true }).lean();
    if (!campaign) return res.status(404).json({ success: false, message: "Không tìm thấy chiến dịch." });
    return ok(res, campaign);
  }),

  deleteCampaign: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    await MarketingCampaignModel.deleteOne({ _id: req.params.id, companyCode });
    return ok(res, { deleted: true });
  }),

  listRuns: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const runs = await MarketingRunModel.find({ companyCode }).sort({ startedAt: -1 }).limit(limit).lean();
    return ok(res, runs);
  }),

  listDeliveries: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const filter: any = { companyCode };
    if (req.query.automationType) filter.automationType = String(req.query.automationType);
    if (req.query.status) filter.status = String(req.query.status);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const deliveries = await MarketingDeliveryModel.find(filter).select("-body").sort({ createdAt: -1 }).limit(limit).lean();
    return ok(res, deliveries);
  }),

  retryDelivery: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    return ok(res, await retryDelivery(companyCode, String(req.params.id)));
  }),

  /** Chạy tay một loại quét, dùng để kiểm thử cấu hình mà không chờ tới giờ gửi. */
  runScan: handle(async (req, res) => {
    const { companyCode, actorId } = scopeOf(req);
    const type = String(req.params.type) as ScheduledScanType;
    if (!MARKETING_SCANS[type]) return res.status(400).json({ success: false, message: "Loại quét không hợp lệ." });
    const settings = await getMarketingSettings(companyCode);
    return ok(res, await MARKETING_SCANS[type](companyCode, settings, new Date(), "manual", actorId));
  }),

  /** Gửi thử tới một địa chỉ cụ thể với dữ liệu mẫu. */
  sendTest: handle(async (req, res) => {
    const { companyCode } = scopeOf(req);
    const type = String(req.body?.automationType || "");
    if (!(MARKETING_AUTOMATION_TYPES as readonly string[]).includes(type)) {
      return res.status(400).json({ success: false, message: "Loại tin không hợp lệ." });
    }
    const settings = await getMarketingSettings(companyCode);
    const config = (settings as any)[type];
    const adapter = await resolveSendableChannel(companyCode, config.channels);
    if (!adapter) return res.status(400).json({ success: false, code: "MARKETING_NO_CHANNEL", message: "Chưa có kênh gửi nào được cấu hình." });
    const recipient = String(req.body?.recipient || "").trim();
    if (!recipient) return res.status(400).json({ success: false, message: "Thiếu địa chỉ nhận thử." });

    const outcome = await queueAndSend({
      companyCode,
      automationType: type as any,
      customer: { name: "Khách hàng mẫu", email: recipient, phone: recipient },
      adapter,
      variables: {
        ...emptyVariables(),
        customerName: "Khách hàng mẫu",
        companyName: await companyNameOf(companyCode),
        orderCode: "DH-MAU-001",
        orderTotal: "1.000.000 ₫",
        holidayName: "Tết Nguyên Đán",
        campaignName: "Chiến dịch mẫu",
        lastPurchaseDate: "2026-01-01",
        inactiveDays: "90",
      },
      idempotencyKey: `${companyCode}:test:${type}:${recipient}:${Date.now()}`,
      template: { subject: config.subject, html: config.html },
    });
    return ok(res, outcome);
  }),
};
