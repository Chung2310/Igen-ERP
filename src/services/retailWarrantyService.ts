import { apiFetch } from "../modules/shared/lib/apiFetch";

export interface WarrantyLookupResult { found: boolean; serialNumber?: string; internalBarcode?: string; product?: { productId: string; variantId?: string; sku: string; name: string }; sold?: { at: string; orderId?: string; orderCode?: string; branchId?: string; customerId?: string }; customerWarranty?: { covered: boolean; endAt?: string; daysLeft?: number }; supplierWarranty?: { covered: boolean; endAt?: string; daysLeft?: number; supplierName?: string }; costBearer?: "supplier" | "shop" | "customer"; status?: string }

export const retailWarrantyService = { async lookup(code: string) { const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult }>(`/retail/warranty/lookup/${encodeURIComponent(code)}`); return result.data; }, async expiring(scope: "supplier" | "customer", days = 30) { const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult[] }>(`/retail/warranty/expiring`, { params: { scope, days } }); return result.data; }, async gapRisk() { const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult[] }>(`/retail/warranty/gap-risk`); return result.data; } };

export interface WarrantyLookupResult { gapMonths?: number }
