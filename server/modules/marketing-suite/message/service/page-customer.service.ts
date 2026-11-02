import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { CustomerService } from "../../../customer-management/customer.service";
import { CustomerModel } from "../../../customer-management/models/customer.model";
import { normalizePhone, phoneLookupVariants } from "../../../customer-management/customer-normalization";

type IntakeField = { key: string; label: string };

export async function savePageCustomer(input: {
  companyCode: string; pageId: string; conversationId: string; message: string;
  fields: IntakeField[]; values: Record<string, string>;
}): Promise<string | undefined> {
  const phoneField = input.fields.find(field => /^(phone|phone_number|so_dien_thoai|sdt)$/i.test(field.key)
    || /số điện thoại|điện thoại|sđt/i.test(field.label));
  const rawPhone = phoneField ? input.values[phoneField.key]?.trim() : "";
  const phone = normalizePhone(rawPhone);
  if (!/^0\d{9}$/.test(phone)) return undefined;
  // Only persist a phone number explicitly present in this customer's inbound message.
  if (!input.message.replace(/\D/g, "").includes(rawPhone.replace(/\D/g, ""))) return undefined;
  const state = await getModuleStateForCompany(input.companyCode);
  if (!state.exists || isServiceSubscriptionBlocked(state) || !state.modules?.includes("customer")) return undefined;
  const companyCode = input.companyCode.trim().toUpperCase();
  const existing = await CustomerModel.findOne({ companyCode, normalizedPhone: { $in: phoneLookupVariants(phone) } }).select("_id").lean();
  if (existing) return String(existing._id);
  const nameField = input.fields.find(field => /^(name|customer_name|full_name|ho_ten|ten_khach_hang)$/i.test(field.key)
    || /^(họ tên|tên khách hàng|tên liên hệ)$/i.test(field.label));
  const name = nameField ? input.values[nameField.key]?.trim().slice(0, 200) : "";
  try {
    const customer = await CustomerService.create({ companyCode }, {
      name: name || `Khách Page ${phone.slice(-4)}`, phone, source: "page",
      notes: `Facebook Page ${input.pageId}; hội thoại ${input.conversationId}`,
    }, { id: "page-chatbot", name: "Chatbot Page" });
    return String(customer._id);
  } catch (error) {
    if ((error as { code?: string }).code !== "CUSTOMER_PHONE_EXISTS") throw error;
    const duplicate = await CustomerModel.findOne({ companyCode, normalizedPhone: { $in: phoneLookupVariants(phone) } }).select("_id").lean();
    if (!duplicate) throw error;
    return String(duplicate._id);
  }
}
