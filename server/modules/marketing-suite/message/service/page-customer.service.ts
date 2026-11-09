import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { CustomerService } from "../../../customer-management/customer.service";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { normalizePhone, phoneLookupVariants } from "../../../customer-management/customer-normalization";
import { appendCustomerNotes } from "../../../customer-management/customer-notes";
import { queuePageCustomerSheet } from "./page-customer-sheet.service";

type IntakeField = { key: string; label: string };
export const PAGE_CUSTOMER_NOTES_KEY = "__customer_notes";

function fieldName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/[_\s]+/g, " ").trim();
}

const profileAliases = new Map([
  ["name", "name"], ["customer name", "name"], ["full name", "name"], ["ho ten", "name"], ["ten khach hang", "name"], ["ten lien he", "name"],
  ["phone", "phone"], ["phone number", "phone"], ["so dien thoai", "phone"], ["dien thoai", "phone"], ["sdt", "phone"],
  ["email", "email"], ["customer email", "email"], ["thu dien tu", "email"],
  ["address", "address"], ["customer address", "address"], ["dia chi", "address"],
  ["contact name", "contactName"], ["contactname", "contactName"], ["nguoi lien he", "contactName"],
  ["notes", "notes"], ["note", "notes"], ["ghi chu", "notes"],
]);

export async function savePageCustomer(input: {
  companyCode: string; pageId: string; conversationId: string; message: string;
  fields: IntakeField[]; values: Record<string, string>; customerId?: string;
}): Promise<string | undefined> {
  const profile: Record<string, string> = {};
  const profileNotes: Array<{ key: string; label: string; value: string }> = [];
  const additions: string[] = [`Facebook Page ${input.pageId}; hội thoại ${input.conversationId}`];
  for (const field of input.fields) {
    const value = input.values[field.key]?.trim();
    if (!value) continue;
    const key = profileAliases.get(fieldName(field.key)) || profileAliases.get(fieldName(field.label))
      || (/số điện thoại|điện thoại|sđt/i.test(field.label) ? "phone" : undefined);
    if (key === "notes") additions.push(value);
    else if (key) {
      profile[key] = value;
      if (key !== "name" && key !== "phone") profileNotes.push({ key, label: field.label, value });
    } else additions.push(`${field.label}: ${value}`);
  }
  const extraNotes = input.values[PAGE_CUSTOMER_NOTES_KEY];
  if (extraNotes) additions.push(...extraNotes.split(/\r?\n/));
  const rawPhone = profile.phone || "";
  const phone = normalizePhone(rawPhone);
  if (!input.customerId) {
    if (!/^0\d{9}$/.test(phone)) return undefined;
    // The first link requires a phone explicitly supplied in the customer's message.
    if (!input.message.replace(/\D/g, "").includes(rawPhone.replace(/\D/g, ""))) return undefined;
  }
  const state = await getModuleStateForCompany(input.companyCode);
  if (!state.exists || isServiceSubscriptionBlocked(state) || !state.modules?.includes("customer")) return undefined;
  const companyCode = input.companyCode.trim().toUpperCase();
  const saved = async (customerId: string) => {
    await queuePageCustomerSheet(companyCode, input.pageId, customerId).catch(error => {
      console.error("[PageCustomerSheet] Không thể xếp lịch đồng bộ hồ sơ ERP:", error);
    });
    return customerId;
  };
  const remember = async (customer: { _id: unknown; email?: string; address?: string; contactName?: string }) => {
    const notes = [...additions, ...profileNotes.filter(field => String(customer[field.key as "email" | "address" | "contactName"] || "").trim() !== field.value)
      .map(field => `${field.label}: ${field.value}`)];
    await CustomerService.appendNotes({ companyCode }, String(customer._id), notes);
    return saved(String(customer._id));
  };
  const filter = input.customerId ? { companyCode, _id: input.customerId }
    : { companyCode, normalizedPhone: { $in: phoneLookupVariants(phone) } };
  const existing = await CustomerModel.findOne(filter).select("_id email address contactName").lean();
  if (existing) return remember(existing);
  if (input.customerId) return undefined;
  try {
    const customer = await CustomerService.create({ companyCode }, {
      ...profile, name: profile.name?.slice(0, 200) || `Khách Page ${phone.slice(-4)}`, phone, source: "page",
      notes: appendCustomerNotes(undefined, additions),
    }, { id: "page-chatbot", name: "Chatbot Page" });
    return saved(String(customer._id));
  } catch (error) {
    if ((error as { code?: string }).code !== "CUSTOMER_PHONE_EXISTS") throw error;
    const duplicate = await CustomerModel.findOne({ companyCode, normalizedPhone: { $in: phoneLookupVariants(phone) } }).select("_id email address contactName").lean();
    if (!duplicate) throw error;
    return remember(duplicate);
  }
}
