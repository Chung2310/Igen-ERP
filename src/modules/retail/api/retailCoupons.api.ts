import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailScope } from "../types";

export interface RetailCouponInput {
  customerTierCodes?: string[];
  customerId?: string | null; customerName?: string; customerCode?: string;
  code: string; name: string; discountType: "amount" | "percent"; value: number;
  minSubtotal: number; maxDiscount: number | null; usageLimit: number | null;
  startsAt: string; endsAt: string; active: boolean;
}
export interface RetailCoupon extends RetailCouponInput { emailDelivery?: { status?: "pending" | "sending" | "sent" | "failed" | "skipped"; reason?: string }; _id: string; usedCount: number; version: number; source?: "manual" | "birthday" | "purchase" }
export type RetailSelectableCoupon = Pick<RetailCoupon, "_id" | "code" | "name" | "discountType" | "value" | "minSubtotal" | "maxDiscount" | "customerId" | "customerTierCodes">;
export interface RetailBirthdayProgram {
  deliveryChannels?: "email"[];
  enabled: boolean; discountType: "amount" | "percent"; value: number;
  minSubtotal: number; maxDiscount: number | null; validityDays: number; version: number;
}
export interface RetailCouponAutomationInput extends RetailBirthdayProgram {
  name: string; trigger: "birthday" | "order_total"; orderMinTotal: number | null;
}
export interface RetailCouponAutomation extends RetailCouponAutomationInput { _id: string; legacy?: boolean }
export const retailCouponsApi = {
  async selectable(scope: RetailScope, customerId?: string) {
    return (await apiFetch<{ data: RetailSelectableCoupon[] }>("/retail/coupons/selectable", { params: { ...scope, ...(customerId ? { customerId } : {}) } })).data;
  },
  async automations(scope: RetailScope) {
    return (await apiFetch<{ data: RetailCouponAutomation[] }>("/retail/coupons/automations", { params: scope })).data;
  },
  async saveAutomation(scope: RetailScope, input: RetailCouponAutomationInput, id?: string) {
    return (await apiFetch<{ data: RetailCouponAutomation }>(`/retail/coupons/automations${id ? `/${id}` : ""}`, { params: scope, method: id ? "PUT" : "POST", body: JSON.stringify(input) })).data;
  },
  async available(scope: RetailScope, customerId: string) {
    return (await apiFetch<{ data: RetailCoupon[] }>("/retail/coupons/available", { params: { ...scope, customerId } })).data;
  },
  async birthdayProgram(scope: RetailScope) {
    return (await apiFetch<{ data: RetailBirthdayProgram }>("/retail/coupons/birthday-program", { params: scope })).data;
  },
  async saveBirthdayProgram(scope: RetailScope, input: RetailBirthdayProgram) {
    return (await apiFetch<{ data: RetailBirthdayProgram }>("/retail/coupons/birthday-program", { params: scope, method: "PUT", body: JSON.stringify(input) })).data;
  },
  async tiers(scope: RetailScope) {
    return (await apiFetch<{ data: Array<{ code: string; name: string }> }>("/retail/coupons/tiers", { params: scope })).data;
  },
  async list(scope: RetailScope, page = 1) {
    return (await apiFetch<{ data: { items: RetailCoupon[]; total: number } }>("/retail/coupons", { params: { ...scope, page } })).data;
  },
  async save(scope: RetailScope, input: RetailCouponInput & { version?: number }, id?: string) {
    return (await apiFetch<{ data: RetailCoupon }>(`/retail/coupons${id ? `/${id}` : ""}`, { params: scope, method: id ? "PUT" : "POST", body: JSON.stringify(input) })).data;
  },
};
