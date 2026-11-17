import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import type { TelecomInvoiceAccount } from "../model/telecom-invoice.model";
import { normalizeIntakeFields } from "./normalize-intake-fields";

export function invoiceFieldName(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
}

const subscriberNames = new Set(["ma thue bao", "so thue bao", "subscriber code", "telecom subscriber code"]);
const invoiceNumberNames = new Set(["ma hoa don", "so hoa don", "invoice number", "invoice no"]);

export function findSubscriberField(fields: LeadIntakeField[], configuredKey?: string) {
  if (configuredKey) return fields.find(field => field.key === configuredKey);
  const matches = fields.filter(field => subscriberNames.has(invoiceFieldName(field.key)) || subscriberNames.has(invoiceFieldName(field.label)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function isInvoiceNumberField(field: LeadIntakeField) {
  return invoiceNumberNames.has(invoiceFieldName(field.key)) || invoiceNumberNames.has(invoiceFieldName(field.label));
}

export async function readActiveInvoiceLeadFields({ companyCode, pageId, platform }: TelecomInvoiceAccount) {
  const scope = { companyCode, status: "active" as const };
  const account = await LeadIntakeProfileModel.findOne({ ...scope, platform, accountId: pageId }).sort({ version: -1 }).select("fields").lean();
  const profile = account ?? await LeadIntakeProfileModel.findOne({ ...scope, platform: { $exists: false } }).sort({ version: -1 }).select("fields").lean();
  const fields = normalizeIntakeFields(profile?.fields);
  return fields && !fields.some(field => field.key === "constructor" || field.key === "prototype") ? fields : [];
}
