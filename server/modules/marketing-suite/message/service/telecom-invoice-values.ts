import { DEFAULT_TELECOM_INVOICE_FIELDS, TELECOM_INVOICE_FIELDS, formatTelecomInvoiceValue, type TelecomInvoiceField, type TelecomInvoiceValues } from "../../../../../shared/marketing-suite/telecom-invoice";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { normalizeIntakeValue } from "./normalize-intake-fields";
import { invoiceFieldName, isInvoiceNumberField } from "./telecom-invoice-profile";
import { customerColumn, serviceValues } from "./telecom-customer-data";

const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");

type InvoiceFieldSnapshot = { fields?: TelecomInvoiceField[]; leadFields?: LeadIntakeField[]; subscriberFieldKey?: string };

export function invoiceReadingFields(snapshot: InvoiceFieldSnapshot): LeadIntakeField[] {
  return snapshot.leadFields ?? (snapshot.fields ?? []).map(key => ({ key, label: TELECOM_INVOICE_FIELDS[key], question: "", required: true }));
}

export function missingInvoiceFields(snapshot: InvoiceFieldSnapshot & { values: TelecomInvoiceValues }) {
  return invoiceReadingFields(snapshot).filter(field => (field.required !== false || field.key === snapshot.subscriberFieldKey) && !snapshot.values[field.key]);
}

export function normalizeInvoiceLeadValue(field: LeadIntakeField, value: unknown, subscriberFieldKey: string) {
  if (field.key === subscriberFieldKey || isInvoiceNumberField(field)) {
    return normalizeInvoiceValue(field.key === subscriberFieldKey ? "subscriberCode" : "invoiceNumber", value);
  }
  // Convert a printed or manually entered Vietnamese date before the shared calendar validation.
  if (field.type === "date" && typeof value === "string") {
    value = value.trim().replace(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/, (_, day, month, year) => `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }
  // Preserve separate service entries before generic text cleanup flattens newlines.
  if ((customerColumn(field.key) === "services" || customerColumn(field.label) === "services")
    && (!field.type || ["text", "long_text", "multi_select"].includes(field.type))) {
    const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    if (!items.length || items.some(item => typeof item !== "string")) return;
    value = [...new Set(items.flatMap(item => serviceValues(item as string)))].join("; ");
  }
  if (typeof value === "string") value = value.replace(/[\r\n\t]+/g, " ").replace(/\p{Cc}|\p{Cf}/gu, "");
  return normalizeIntakeValue(field, value);
}

export function normalizeInvoiceValue(field: TelecomInvoiceField, input: unknown): string | undefined {
  if (typeof input !== "string") return;
  const value = input.normalize("NFKC").replace(/[\r\n\t]+/g, " ").replace(/\p{Cc}|\p{Cf}/gu, "").trim();
  if (!value || value.length > 120) return;
  if (field === "subscriberCode" || field === "invoiceNumber") {
    return /^[a-z0-9][a-z0-9._/-]{0,63}$/i.test(value) ? value.toUpperCase() : undefined;
  }
  if (field === "amountDue") {
    const amount = normalizeText(value).replace(/\s*(?:vnd|dong|d)\s*$/, "");
    if (!/^(?:\d{1,13}|\d{1,3}(?:[., ]\d{3}){1,4})$/.test(amount)) return;
    return String(Number(amount.replace(/[., ]/g, "")));
  }
  return value;
}

export type InvoiceCommand = { type: "all" | "yes" | "show" }
  | { type: "confirm" | "skip"; images: number[] }
  | { type: "edit"; image: number; field?: TelecomInvoiceField; label?: string; value?: string };

const fieldAliases: Record<TelecomInvoiceField, string[]> = {
  subscriberCode: ["mã thuê bao", "số thuê bao", "thuê bao"],
  customerName: ["tên khách hàng", "họ và tên", "tên khách", "họ tên", "tên"],
  invoiceNumber: ["mã hóa đơn", "số hóa đơn"],
  billingPeriod: ["kỳ cước", "kỳ hóa đơn", "tháng cước"],
  amountDue: ["số tiền phải trả", "tiền phải trả", "số tiền", "tổng tiền", "tiền"],
};

export function findInvoiceEditField(snapshot: InvoiceFieldSnapshot, command: Extract<InvoiceCommand, { type: "edit" }>) {
  const fields = invoiceReadingFields(snapshot);
  const label = command.label ? invoiceFieldName(command.label) : "";
  const matching = label ? fields.filter(field => invoiceFieldName(field.label) === label || invoiceFieldName(field.key) === label) : [];
  if (matching.length) return matching.length === 1 ? matching[0] : undefined;
  const key = command.field ?? DEFAULT_TELECOM_INVOICE_FIELDS.find(candidate => fieldAliases[candidate].some(alias => invoiceFieldName(alias) === label));
  if (!key) return;
  if (!snapshot.leadFields) return fields.find(field => field.key === key);
  if (key === "subscriberCode") return fields.find(field => field.key === snapshot.subscriberFieldKey);
  const aliases = fieldAliases[key].map(invoiceFieldName);
  const matches = fields.filter(field => aliases.includes(invoiceFieldName(field.label)) || aliases.includes(invoiceFieldName(field.key)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function parseInvoiceCommands(message: string): InvoiceCommand[] {
  const clauses = message.normalize("NFC").split(/\n|;\s*(?=(?:ảnh|hình|xác nhận|bỏ ảnh)\b)|,\s*(?=(?:xác nhận|bỏ ảnh)(?=\s)|(?:ảnh|hình)(?: số)?\s+\d+\s*(?::|(?:đúng|sửa|đổi|chỉnh|là|mã|số tiền|tên|kỳ|bỏ|hủy)(?=\s|$)))|\s+và\s+(?=ảnh\s+\d+\s+(?:đúng|sửa|là|xác nhận))/iu);
  return clauses.flatMap<InvoiceCommand>(raw => {
    const clause = raw.trim().replace(/^\d+\.\s+/, "").replace(/[.!?]+$/, "");
    const text = normalizeText(clause).replace(/\s+/g, " ").trim();
    if (/^(?:xac nhan tat ca(?: anh)?|tat ca (?:anh )?deu dung)(?: a| nhe)?$/.test(text)) return [{ type: "all" } as const];
    if (/^(?:ok|oke|oki|dong y|dung|dung roi|xac nhan|da dung|da dung roi)(?: a| em| nhe| nha)?$/.test(text)) return [{ type: "yes" } as const];
    if (/^(?:xem lai|gui lai|cho xem lai) (?:cac anh|hoa don|thong tin hoa don)$/.test(text)) return [{ type: "show" } as const];
    const confirm = text.match(/^(?:xac nhan|bo|bo qua) (?:anh|hinh)(?: so)? (\d+(?:\s*(?:,|va)\s*(?:(?:anh|hinh)\s+)?\d+)*)(?: a| nhe| nha)?$/);
    if (confirm) return [{ type: text.startsWith("xac nhan") ? "confirm" : "skip", images: confirm[1].match(/\d+/g)!.map(Number) } as const];
    const match = text.match(/^(?:anh|hinh)(?: so)?\s+(\d+)(?:\s*[:\-]\s*|\s+)(.*)$/);
    if (!match) return [];
    const image = Number(match[1]);
    const action = match[2];
    if (/^(?:dung|dung roi|xac nhan|chinh xac)(?: a| nhe| nha)?$/.test(action)) return [{ type: "confirm", images: [image] } as const];
    if (/^(?:bo qua|huy)(?: a| nhe| nha)?$/.test(action)) return [{ type: "skip", images: [image] } as const];
    const originalAction = clause.match(/^(?:ảnh|hình|anh|hinh)(?: số| so)?\s+\d+(?:\s*[:\-]\s*|\s+)(.*)$/iu)?.[1] || "";
    const cleaned = originalAction.replace(/^(?:sửa|sua|đổi|doi|chỉnh|chinh)\s+(?:(?:lại|lai)\s+)?/iu, "");
    const labeled = cleaned.match(/^(.{1,100}?)(?:\s+(?:là|la)\s+|\s*[:=]\s*)(.+)$/iu)
      ?? cleaned.match(/^(.{1,100})\s+(?:thành|thanh)\s+(.+)$/iu);
    if (labeled) return [{ type: "edit", image, label: labeled[1].trim(), value: labeled[2] }];
    const normalized = normalizeText(cleaned);
    for (const field of DEFAULT_TELECOM_INVOICE_FIELDS) {
      const alias = fieldAliases[field].map(normalizeText).find(label => normalized === label || normalized.startsWith(`${label} `) || normalized.startsWith(`${label}:`) || normalized.startsWith(`${label}=`));
      if (alias) {
        const value = cleaned.slice(alias.length).replace(/^\s*(?:là\s+|la\s+|thành\s+|thanh\s+|[:=]\s*)?/iu, "");
        return [{ type: "edit", image, field, value } as const];
      }
    }
    const amount = cleaned.replace(/^(?:thành|thanh|là|la)\s+/iu, "");
    if (/\s*(?:đ|d|vnd|đồng)$/iu.test(amount)) {
      return [{ type: "edit", image, field: "amountDue", value: normalizeInvoiceValue("amountDue", amount) } as const];
    }
    return [];
  });
}

export function summarizeInvoice(number: number, snapshot: InvoiceFieldSnapshot & { values: TelecomInvoiceValues; unclearFields?: string[] }): string {
  const fields = invoiceReadingFields(snapshot).filter(field => snapshot.values[field.key] || field.required !== false
    || field.key === snapshot.subscriberFieldKey || snapshot.unclearFields?.includes(field.key));
  return [`Ảnh ${number}`, ...fields.map(field => {
    const value = snapshot.values[field.key];
    return `${field.label}: ${value ? formatTelecomInvoiceValue(field.key, value, field.type) : snapshot.unclearFields?.includes(field.key) ? "chưa đọc rõ" : "chưa có thông tin"}`;
  })].join(" · ");
}
