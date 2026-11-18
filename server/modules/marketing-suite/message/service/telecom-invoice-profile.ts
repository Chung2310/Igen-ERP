import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import type { TelecomInvoiceAccount } from "../model/telecom-invoice.model";
import { normalizeIntakeFields } from "./normalize-intake-fields";
import { readLeadIntakeProfiles } from "./read-lead-intake-profiles";

export function invoiceFieldName(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
}

const subscriberNames = new Set(["ma thue bao", "so thue bao", "thue bao", "tai khoan thue bao", "account", "subscriber code", "subscribercode", "telecom subscriber code"]);
const invoiceNumberNames = new Set(["ma hoa don", "so hoa don", "invoice number", "invoice no"]);

export function isTelecomStaffField(field: Pick<LeadIntakeField, "key" | "label">) {
  return /\b(?:nhan vien|nguoi xu ly|ky thuat vien|nhan vien ky thuat|technician|staff|employee|handler)\b/
    .test([field.key, field.label].map(invoiceFieldName).join(" "));
}

export function findSubscriberField(fields: LeadIntakeField[], configuredKey?: string) {
  if (configuredKey) return fields.find(field => field.key === configuredKey);
  const matches = fields.filter(field => subscriberNames.has(invoiceFieldName(field.key)) || subscriberNames.has(invoiceFieldName(field.label)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function findContractField(fields: LeadIntakeField[], configuredKey?: string) {
  const eligible = fields.filter(field => !field.type || field.type === "text");
  if (configuredKey) return eligible.find(field => field.key === configuredKey);
  const identifiers = new Set(["so hd", "ma hd", "so hop dong", "ma hop dong", "contract code", "contract number"]);
  const matches = eligible.filter(field => identifiers.has(invoiceFieldName(field.key)) || identifiers.has(invoiceFieldName(field.label)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function isInvoiceNumberField(field: LeadIntakeField) {
  return invoiceNumberNames.has(invoiceFieldName(field.key)) || invoiceNumberNames.has(invoiceFieldName(field.label));
}

export async function readActiveInvoiceLeadFields({ companyCode, pageId, platform }: TelecomInvoiceAccount) {
  const { account, company } = await readLeadIntakeProfiles(companyCode, platform, pageId);
  const profile = company?.applyToAllAccounts ? company : account ?? company;
  const fields = normalizeIntakeFields(profile?.fields);
  return fields && !fields.some(field => field.key === "constructor" || field.key === "prototype") ? fields : [];
}
