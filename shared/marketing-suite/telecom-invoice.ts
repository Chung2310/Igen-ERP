import type { LeadIntakeField } from "./lead-intake";

export const TELECOM_INVOICE_FIELDS = {
  subscriberCode: "Mã thuê bao",
  customerName: "Tên khách hàng",
  invoiceNumber: "Mã hóa đơn",
  billingPeriod: "Kỳ cước",
  amountDue: "Số tiền phải trả",
} as const;

export type TelecomInvoiceField = keyof typeof TELECOM_INVOICE_FIELDS;
export type TelecomInvoicePlatform = "facebook" | "zalo";
export type TelecomInvoiceValues = Record<string, string | undefined>;
export const DEFAULT_TELECOM_INVOICE_FIELDS = Object.keys(TELECOM_INVOICE_FIELDS) as TelecomInvoiceField[];

export type TelecomInvoiceSettingsInput = { enabled: boolean; subscriberFieldKey?: string };
export type TelecomInvoiceSettings = TelecomInvoiceSettingsInput & { leadFields: Array<Pick<LeadIntakeField, "key" | "label">> };

export function formatTelecomInvoiceValue(field: string, value: string, type?: LeadIntakeField["type"]): string {
  if (type === "date") return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  if ((type === "currency" || field === "amountDue") && Number.isFinite(Number(value))) {
    return `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 12 })}đ`;
  }
  return value;
}

export interface ConfirmedTelecomInvoice {
  id: string;
  platform: TelecomInvoicePlatform;
  values: TelecomInvoiceValues;
  leadFields?: LeadIntakeField[];
  subscriberFieldKey?: string;
  invoiceNumber?: string;
  pageId: string;
  conversationId: string;
  confirmedAt: string;
  imageUrl?: string;
}
