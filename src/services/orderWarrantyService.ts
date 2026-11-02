import { apiFetch } from "../modules/shared/lib/apiFetch";

export type OrderWarrantyStatus = "active" | "expiring" | "expired" | "pending" | "none" | "unrecorded";
export interface OrderWarrantyRow {
  id: string; orderId: string; orderCode: string; invoiceNo?: string;
  customerName?: string; customerPhone?: string;
  productId: string; sku?: string; productName: string; quantity: number;
  soldAt?: string; warrantyStartAt?: string; warrantyEndAt?: string;
  warrantyMonths?: number; status: OrderWarrantyStatus; daysLeft?: number | null;
}
export interface OrderWarrantyResult { items: OrderWarrantyRow[]; total: number; page: number; limit: number }
export const orderWarrantyService = {
  async list(params: { companyCode: string; branchId: string; q: string; status: OrderWarrantyStatus | "all"; days: number; page: number }, signal?: AbortSignal) {
    const result = await apiFetch<{ success: boolean; data: OrderWarrantyResult }>("/retail/warranty/orders", { params, signal });
    return result.data;
  },
};
