import { BranchModel } from "../../../model/branch.model";
import { CompanyModel } from "../../../model/company.model";
import { MARKETING_CHANNEL_ADAPTERS, resolveSendableChannel, type MarketingChannelAdapter } from "../../marketing/services/marketing-channels";
import { renderTemplateWithKeys } from "../../marketing/services/marketing-template";
import { getCustomerContact } from "../../customer-management/contracts";
import { RepairNotificationModel } from "../repair-notification.model";
import { DEFAULT_REPAIR_TEMPLATES, RepairSettingsModel, type RepairTemplate } from "../repair-settings.model";
import type { RepairNotificationEvent } from "../permissions";

export const REPAIR_VARIABLE_KEYS = ["companyName", "branchName", "customerName", "ticketCode", "deviceName", "symptom", "receivedAt", "promisedAt", "totalAmount", "feedbackUrl"] as const;
export type RepairVariables = Record<(typeof REPAIR_VARIABLE_KEYS)[number], string>;

const money = (value: unknown) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const when = (value: unknown) => (value ? new Date(value as string).toLocaleString("vi-VN") : "—");

export function renderRepairTemplate(template: string, variables: RepairVariables): string {
  return renderTemplateWithKeys(template, variables, REPAIR_VARIABLE_KEYS, "REPAIR_UNKNOWN_VARIABLE");
}

export function buildRepairVariables(ticket: any, context: { companyName: string; branchName: string; feedbackUrl: string }): RepairVariables {
  return {
    companyName: context.companyName,
    branchName: context.branchName,
    customerName: String(ticket.customerName || ""),
    ticketCode: String(ticket.ticketCode || ""),
    deviceName: String(ticket.device?.name || ""),
    symptom: String(ticket.symptom || ""),
    receivedAt: when(ticket.receivedAt),
    promisedAt: when(ticket.promisedAt),
    totalAmount: money(ticket.totalAmount),
    feedbackUrl: context.feedbackUrl,
  };
}

export async function getRepairTemplate(companyCode: string, event: RepairNotificationEvent): Promise<RepairTemplate> {
  const settings: any = await RepairSettingsModel.findOne({ companyCode: companyCode.toUpperCase() }).lean();
  const configured = settings?.templates?.[event];
  const fallback = DEFAULT_REPAIR_TEMPLATES[event];
  if (!configured) return fallback;
  return {
    enabled: configured.enabled !== false,
    subject: String(configured.subject || "").trim() || fallback.subject,
    html: String(configured.html || "").trim() || fallback.html,
  };
}

async function resolveRecipientContact(ticket: any) {
  if (ticket.customerPhone || ticket.customerId) {
    const contact = ticket.customerId
      ? await getCustomerContact({ companyCode: String(ticket.companyCode) }, String(ticket.customerId), { includeInactive: true }).catch(() => null)
      : null;
    return { email: contact?.email, phone: contact?.phone || String(ticket.customerPhone || "") };
  }
  return { email: undefined, phone: "" };
}

export type RepairNotifyDeps = {
  resolveChannel?: (companyCode: string, preferred: readonly string[]) => Promise<MarketingChannelAdapter | undefined>;
};

/**
 * Gửi thông báo cho khách và ghi nhật ký. Không bao giờ ném lỗi ra ngoài: việc gửi tin
 * không được làm hỏng nghiệp vụ tiếp nhận / chuyển trạng thái phiếu. Trùng
 * idempotencyKey thì bỏ qua im lặng, giống cách marketing chống gửi lặp.
 */
export async function sendRepairNotification(ticket: any, event: RepairNotificationEvent, deps: RepairNotifyDeps = {}) {
  const companyCode = String(ticket.companyCode || "").toUpperCase();
  const idempotencyKey = `repair:${String(ticket._id)}:${event}`;
  const base = { companyCode, branchId: String(ticket.branchId || ""), ticketId: String(ticket._id), ticketCode: String(ticket.ticketCode || ""), event, idempotencyKey, sentAt: new Date() };
  const log = async (row: Record<string, unknown>) => {
    try {
      return await RepairNotificationModel.create({ ...base, ...row });
    } catch (error: any) {
      if (error?.code === 11000) return null; // đã gửi trước đó
      throw error;
    }
  };

  try {
    if (await RepairNotificationModel.exists({ companyCode, idempotencyKey })) return { status: "skipped" as const, reason: "ALREADY_SENT" };

    const template = await getRepairTemplate(companyCode, event);
    if (!template.enabled) { await log({ status: "skipped", reason: "TEMPLATE_DISABLED" }); return { status: "skipped" as const, reason: "TEMPLATE_DISABLED" }; }

    const settings: any = await RepairSettingsModel.findOne({ companyCode }).select("notifyChannels").lean();
    const preferred: string[] = settings?.notifyChannels?.length ? settings.notifyChannels : ["email", "zalo", "sms"];
    const resolve = deps.resolveChannel || resolveSendableChannel;
    const adapter = await resolve(companyCode, preferred);
    if (!adapter) { await log({ status: "skipped", reason: "NO_CHANNEL" }); return { status: "skipped" as const, reason: "NO_CHANNEL" }; }

    const contact = await resolveRecipientContact(ticket);
    const recipient = adapter.recipientOf(contact);
    if (!recipient) { await log({ status: "skipped", channel: adapter.channel, reason: "NO_RECIPIENT" }); return { status: "skipped" as const, reason: "NO_RECIPIENT" }; }

    const [company, branch]: any[] = await Promise.all([
      CompanyModel.findOne({ code: companyCode }).select("name").lean(),
      ticket.branchId ? BranchModel.findOne({ companyCode, _id: ticket.branchId }).select("name").lean().catch(() => null) : null,
    ]);
    const appUrl = String(process.env.APP_URL || "").replace(/\/+$/, "");
    const variables = buildRepairVariables(ticket, {
      companyName: String(company?.name || companyCode),
      branchName: String(branch?.name || ""),
      feedbackUrl: ticket.feedbackToken ? `${appUrl}/repair/feedback/${ticket.feedbackToken}` : "",
    });

    const message = { to: recipient, subject: renderRepairTemplate(template.subject, variables), html: renderRepairTemplate(template.html, variables) };
    const result = await adapter.send(companyCode, message);
    await log({ status: "sent", channel: adapter.channel, recipient, messageId: result.messageId });
    return { status: "sent" as const, channel: adapter.channel };
  } catch (error: any) {
    const reason = String(error?.message || error);
    await log({ status: "failed", reason }).catch(() => undefined);
    return { status: "failed" as const, reason };
  }
}

export function listRepairChannels() {
  return Object.values(MARKETING_CHANNEL_ADAPTERS).map((adapter) => ({ channel: adapter.channel, label: adapter.label, implemented: adapter.implemented }));
}

/**
 * Gửi tin ở chế độ "không chặn": phiếu đã lưu xong mới gửi, gửi xong mới đánh dấu
 * customerNotified theo kết quả thật thay vì tin lời khai của client.
 */
export async function dispatchRepairNotification(ticket: any, event: RepairNotificationEvent, deps: RepairNotifyDeps = {}) {
  const result = await sendRepairNotification(ticket, event, deps);
  if (result.status !== "sent") return result;
  const { RepairTicketModel } = await import("../repair-ticket.model");
  await RepairTicketModel.updateOne(
    { _id: ticket._id, companyCode: String(ticket.companyCode).toUpperCase() },
    { $set: { "statusHistory.$[entry].customerNotified": true } },
    { arrayFilters: [{ "entry.to": event === "received" ? "received" : "done" }] },
  ).catch(() => undefined);
  return result;
}
