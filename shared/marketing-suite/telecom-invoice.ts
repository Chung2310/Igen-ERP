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

export type TelecomInvoiceSettingsInput = {
  enabled: boolean;
  subscriberFieldKey?: string;
  mode?: "invoice" | "contract";
  contractFieldKey?: string;
  contractProvider?: string;
};
export type TelecomInvoiceSettings = TelecomInvoiceSettingsInput & { leadFields: Array<Pick<LeadIntakeField, "key" | "label" | "type">> };

export function normalizeLeadContractCode(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const code = value.normalize("NFKC").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._/-]{0,79}$/.test(code) ? code : undefined;
}

export function normalizeLeadContractProvider(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const provider = value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  return provider.length > 0 && provider.length <= 80 && !/\p{C}/u.test(provider) ? provider : undefined;
}

export type LeadContractStatus = "matched" | "excel_only" | "lead_only" | "needs_review" | "different" | "incomplete";
export type TelecomCustomerInfo = {
  customerName?: string; address?: string; services?: string[]; activatedAt?: string; periods?: string[];
};
export type TelecomCustomerDifference = {
  field: string; label: string; excel: string; lead: string;
  reason: "different" | "missing_excel" | "missing_lead";
};
export type LeadContractComparison = {
  code: string;
  status: LeadContractStatus;
  leadId?: string;
  customerName?: string;
  excel?: TelecomCustomerInfo;
  lead?: TelecomCustomerInfo;
  differences?: TelecomCustomerDifference[];
  sourceRows?: number[];
  sourceSerial?: string;
  excelCode?: string;
  issue?: string;
};
export type LeadContractReport = {
  rows: LeadContractComparison[];
  excelRows?: LeadContractComparison[];
  excelCount: number;
  duplicates: number;
  invalidRows: number[];
  provider?: string;
  identityLabel?: string;
  sheetName?: string;
  period?: string;
  sourceRowCount?: number;
};
export type LeadContractPhoto = {
  id: string;
  provider: string;
  platform: TelecomInvoicePlatform;
  pageId: string;
  conversationId: string;
  receivedAt: string;
  contractCode?: string;
  values: Record<string, string>;
  fields: LeadIntakeField[];
  contractFieldKey: string;
  issue?: string;
};

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
