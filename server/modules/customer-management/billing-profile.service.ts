import { Types } from "mongoose";
import { CustomerError } from "./customer-errors";
import type { BillingProfileInput, BillingProfileSnapshot } from "./interfaces/customer-billing-profile.interface";
import { CustomerBillingProfileModel } from "./models/customer-billing-profile.model";
import { CustomerModel } from "./models/customer.model";
import type { CustomerActor, CustomerScope } from "./customer.service";

const required = (value: unknown, label: string) => { const text = String(value || "").trim(); if (!text) throw new CustomerError("BILLING_PROFILE_INVALID", `${label} là bắt buộc.`); return text; };
export function normalizeBillingProfileInput(input: BillingProfileInput | Record<string, unknown>) {
  const invoiceEmail = required(input.invoiceEmail, "Email nhận hóa đơn").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) throw new CustomerError("BILLING_PROFILE_INVALID", "Email nhận hóa đơn không hợp lệ.");
  const taxId = required(input.taxId, "Mã số thuế");
  if (!/^\d{10}(?:\d{3})?$/.test(taxId.replace(/-/g, ""))) throw new CustomerError("BILLING_PROFILE_INVALID", "Mã số thuế không hợp lệ.");
  const contactName = String(input.contactName || "").trim();
  return { legalName: required(input.legalName, "Tên pháp nhân"), taxId, address: required(input.address, "Địa chỉ xuất hóa đơn"), invoiceEmail, ...(contactName ? { contactName } : {}) };
}
type Repo = { customer(scope: CustomerScope, id: string): Promise<any>; list(scope: CustomerScope, id: string): Promise<any[]>; taxIdCustomers(scope: CustomerScope, taxId: string): Promise<string[]>; clearDefault(scope: CustomerScope, id: string): Promise<unknown>; create(values: any): Promise<any>; setCustomerVat(scope: CustomerScope, id: string): Promise<unknown> };
export function createBillingProfileService(repo: Repo) { return {
  async list(scope: CustomerScope, customerId: string) { return repo.list(scope, customerId); },
  async create(scope: CustomerScope, customerId: string, input: BillingProfileInput, actor: CustomerActor) {
    if (!Types.ObjectId.isValid(customerId)) throw new CustomerError("CUSTOMER_ID_INVALID", "Mã khách hàng không hợp lệ.");
    const customer = await repo.customer(scope, customerId); if (!customer) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404); if (customer.status !== "active") throw new CustomerError("CUSTOMER_INACTIVE", "Khách hàng đã ngừng hoạt động.", 409);
    const values = normalizeBillingProfileInput(input); const existing = await repo.list(scope, customerId); const isDefault = existing.length === 0 || Boolean(input.isDefault);
    if (isDefault) await repo.clearDefault(scope, customerId);
    const reused = (await repo.taxIdCustomers(scope, values.taxId)).some((id) => id !== customerId);
    const profile = await repo.create({ ...scope, customerId, ...values, isDefault, status: "active", createdBy: actor.id, createdByName: actor.name, version: 0 });
    await repo.setCustomerVat(scope, customerId);
    return { profile, warnings: reused ? [{ code: "BILLING_TAX_ID_REUSED", message: "Mã số thuế đang được dùng bởi khách hàng khác." }] : [] };
  },
}; }
const repo: Repo = { customer: (scope, id) => CustomerModel.findOne({ _id: id, ...scope }).lean(), list: (scope, id) => CustomerBillingProfileModel.find({ ...scope, customerId: id }).sort({ isDefault: -1, createdAt: -1 }).lean(), taxIdCustomers: async (scope, taxId) => (await CustomerBillingProfileModel.distinct("customerId", { ...scope, taxId } as any)).map(String), clearDefault: (scope, id) => CustomerBillingProfileModel.updateMany({ ...scope, customerId: id, isDefault: true }, { $set: { isDefault: false } }), create: async (values) => (await CustomerBillingProfileModel.create(values)).toObject(), setCustomerVat: (scope, id) => CustomerModel.updateOne({ _id: id, ...scope }, { $set: { type: "vat" }, $inc: { version: 1 } }) };
export const BillingProfileService = createBillingProfileService(repo);
export async function getBillingProfile(scope: CustomerScope, customerId: string, profileId: string): Promise<(BillingProfileSnapshot & { profileId: string }) | null> { if (!Types.ObjectId.isValid(profileId)) return null; const value: any = await CustomerBillingProfileModel.findOne({ _id: profileId, ...scope, customerId, status: "active" }).lean(); return value ? { profileId: String(value._id), legalName: value.legalName, taxId: value.taxId, address: value.address, invoiceEmail: value.invoiceEmail, contactName: value.contactName } : null; }
