import { companyEmailService } from "../../../service/company-email.service";
import type { MarketingChannel } from "../permissions";

export type MarketingMessage = { to: string; subject: string; html: string };
export type MarketingSendResult = { messageId: string };

export type MarketingChannelAdapter = {
  channel: MarketingChannel;
  label: string;
  /** false = mới có khung, chưa nối API nhà cung cấp. */
  implemented: boolean;
  /** Kiểm tra công ty đã cấu hình đủ để gửi qua kênh này chưa. */
  isConfigured(companyCode: string): Promise<boolean>;
  /** Địa chỉ nhận của kênh (email / số điện thoại / zalo id...). */
  recipientOf(customer: { email?: string; phone?: string }): string;
  send(companyCode: string, message: MarketingMessage): Promise<MarketingSendResult>;
};

const notImplemented = (channel: MarketingChannel, label: string, useEmail = false): MarketingChannelAdapter => ({
  channel,
  label,
  implemented: false,
  isConfigured: async () => false,
  recipientOf: (customer) => String((useEmail ? customer.email : customer.phone) || ""),
  async send() { throw new Error(`MARKETING_CHANNEL_NOT_IMPLEMENTED:${channel}`); },
});

const emailAdapter: MarketingChannelAdapter = {
  channel: "email",
  label: "Email",
  implemented: true,
  async isConfigured(companyCode) {
    const smtp = await companyEmailService.getSmtp(companyCode);
    return Boolean(smtp?.hasPassword);
  },
  recipientOf: (customer) => String(customer.email || "").trim().toLowerCase(),
  async send(companyCode, message) {
    const result = await companyEmailService.send(companyCode, { to: message.to, subject: message.subject, html: message.html });
    return { messageId: String((result as any)?.messageId || "") };
  },
};

export const MARKETING_CHANNEL_ADAPTERS: Record<MarketingChannel, MarketingChannelAdapter> = {
  email: emailAdapter,
  sms: notImplemented("sms", "SMS"),
  zalo: notImplemented("zalo", "Zalo ZNS"),
  tiktok: notImplemented("tiktok", "TikTok"),
};

/**
 * Chọn kênh đầu tiên trong danh sách ưu tiên vừa đã nối API vừa đã cấu hình.
 * Chưa có kênh nào dùng được thì trả về undefined để scan ghi "skipped" kèm lý do.
 */
export async function resolveSendableChannel(companyCode: string, preferred: readonly string[]) {
  for (const name of preferred) {
    const adapter = MARKETING_CHANNEL_ADAPTERS[name as MarketingChannel];
    if (!adapter?.implemented) continue;
    if (await adapter.isConfigured(companyCode)) return adapter;
  }
  return undefined;
}
