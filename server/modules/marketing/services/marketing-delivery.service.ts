import { CompanyModel } from "../../../model/company.model";
import { MarketingDeliveryModel } from "../models/marketing-delivery.model";
import type { MarketingAutomationType } from "../permissions";
import { MARKETING_CHANNEL_ADAPTERS, resolveSendableChannel, type MarketingAttachment, type MarketingChannelAdapter } from "./marketing-channels";
import { attachmentRefForDelivery, resolveMarketingAttachments, type MarketingAttachmentRef } from "./marketing-invoice-attachment.service";
import { renderMarketingTemplate, type MarketingVariables } from "./marketing-template";

const duplicate = (error: any) => error?.code === 11000;
export const MARKETING_STALE_DELIVERY_MS = 20 * 60 * 1000;
export const MARKETING_STALE_DELIVERY_ERROR = "Tiến trình bị gián đoạn nên chưa xác định được email đã được nhà cung cấp nhận hay chưa. Hãy kiểm tra trước khi gửi lại để tránh gửi trùng.";

export type QueueInput = {
  companyCode: string;
  automationType: MarketingAutomationType;
  idempotencyKey: string;
  runId?: string;
  campaignId?: string;
  customer: { _id?: any; name?: string; email?: string; phone?: string };
  template: { subject: string; html: string };
  variables: MarketingVariables;
  adapter: MarketingChannelAdapter;
  /** Tệp gửi kèm; kênh không hỗ trợ đính kèm sẽ bỏ qua. */
  attachments?: MarketingAttachment[];
  attachmentRef?: MarketingAttachmentRef;
};

export type QueueOutcome = { status: "sent" | "failed" | "skipped" | "duplicate"; reason?: string };

export async function companyNameOf(companyCode: string) {
  const company: any = await CompanyModel.findOne({ code: companyCode.toUpperCase() }).select("name").lean();
  return String(company?.name || companyCode);
}

/**
 * A process can stop after creating a delivery but before saving the SMTP result.
 * Make those rows visible as uncertain failures so a manager can inspect and
 * explicitly decide whether to retry; never resend them automatically.
 */
export async function recoverStaleMarketingDeliveries(now = new Date()) {
  const staleBefore = new Date(now.getTime() - MARKETING_STALE_DELIVERY_MS);
  const result = await MarketingDeliveryModel.updateMany(
    { status: "sending", updatedAt: { $lte: staleBefore } },
    { $set: { status: "failed", error: MARKETING_STALE_DELIVERY_ERROR } },
  );
  return result.modifiedCount;
}

/**
 * Tạo bản ghi delivery rồi gửi ngay. Trùng khoá idempotency thì bỏ qua im lặng —
 * đó là cách chống gửi lặp khi scan chạy lại hoặc outbox worker retry.
 */
export async function queueAndSend(input: QueueInput): Promise<QueueOutcome> {
  const recipient = input.adapter.recipientOf(input.customer);
  if (!recipient) return { status: "skipped", reason: "NO_RECIPIENT" };

  let subject: string;
  let html: string;
  try {
    subject = renderMarketingTemplate(input.template.subject, input.variables);
    html = renderMarketingTemplate(input.template.html, input.variables);
  } catch (error: any) {
    return { status: "failed", reason: String(error?.message || error) };
  }

  let row: any;
  try {
    row = await MarketingDeliveryModel.create({
      companyCode: input.companyCode.toUpperCase(),
      automationType: input.automationType,
      channel: input.adapter.channel,
      idempotencyKey: input.idempotencyKey,
      runId: input.runId || "",
      campaignId: input.campaignId || "",
      customerId: String(input.customer._id || ""),
      customerName: String(input.customer.name || ""),
      recipient,
      subject,
      body: html,
      attachmentRef: input.attachmentRef || null,
      status: "sending",
      attempt: 1,
    });
  } catch (error) {
    if (duplicate(error)) return { status: "duplicate" };
    throw error;
  }

  try {
    const attachments = input.adapter.supportsAttachments ? input.attachments : undefined;
    const result = await input.adapter.send(input.companyCode, { to: recipient, subject, html, attachments });
    await MarketingDeliveryModel.updateOne({ _id: row._id }, { $set: { status: "sent", sentAt: new Date(), messageId: result.messageId } });
    return { status: "sent" };
  } catch (error: any) {
    const message = String(error?.message || error).slice(0, 500);
    await MarketingDeliveryModel.updateOne({ _id: row._id }, { $set: { status: "failed", error: message } });
    return { status: "failed", reason: message };
  }
}

/** Gửi lại một tin đã lỗi, giữ nguyên nội dung đã render. */
export async function retryDelivery(companyCode: string, deliveryId: string) {
  const delivery: any = await MarketingDeliveryModel.findOneAndUpdate(
    { _id: deliveryId, companyCode: companyCode.toUpperCase(), status: "failed", $expr: { $lt: ["$attempt", "$maxAttempts"] } },
    { $set: { status: "sending" }, $inc: { attempt: 1 } },
    { returnDocument: 'after' },
  ).lean();
  if (!delivery) throw new Error("MARKETING_DELIVERY_NOT_RETRYABLE");

  const adapter = MARKETING_CHANNEL_ADAPTERS[delivery.channel as keyof typeof MARKETING_CHANNEL_ADAPTERS];
  try {
    if (!adapter?.implemented) throw new Error(`MARKETING_CHANNEL_NOT_IMPLEMENTED:${delivery.channel}`);
    const ref = adapter.supportsAttachments ? attachmentRefForDelivery(delivery) : null;
    const attachments = ref ? await resolveMarketingAttachments(companyCode, ref) : undefined;
    const result = await adapter.send(companyCode, {
      to: delivery.recipient,
      subject: delivery.subject,
      html: delivery.body,
      ...(attachments ? { attachments } : {}),
    });
    await MarketingDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "sent", sentAt: new Date(), messageId: result.messageId, error: "" } });
    return { status: "sent" as const };
  } catch (error: any) {
    const message = String(error?.message || error).slice(0, 500);
    await MarketingDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "failed", error: message } });
    return { status: "failed" as const, error: message };
  }
}

export { resolveSendableChannel };
