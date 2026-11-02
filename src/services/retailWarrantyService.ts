import { apiFetch } from "../modules/shared/lib/apiFetch";

export interface WarrantyLookupResult {
  found: boolean;
  _id?: string;
  serialNumber?: string;
  internalBarcode?: string;
  sku?: string;
  productName?: string;
  product?: { productId?: string; variantId?: string; sku: string; name: string };
  warehouseId?: string;
  sold?: {
    at: string;
    orderId?: string;
    orderCode?: string;
    branchId?: string;
    customerId?: string;
    customerCode?: string;
    customerName?: string;
    customerPhone?: string;
  };
  customerWarranty?: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number };
  supplierWarranty?: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number; supplierId?: string; supplierName?: string };
  costBearer?: "supplier" | "shop" | "customer";
  status?: string;
  gapMonths?: number;
}

export interface PhoneWarrantyLookupResult {
  found: boolean;
  customer?: {
    customerId?: string;
    customerCode?: string;
    name?: string;
    phone?: string;
  };
  totalDevices: number;
  devices: WarrantyLookupResult[];
}

export interface WarrantyLookupScope { companyCode: string; branchId: string }
type WarrantyRequest = WarrantyLookupScope & { signal?: AbortSignal };

export const retailWarrantyService = {
  async lookup(code: string, options?: WarrantyRequest) {
    const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult }>(
      `/retail/warranty/lookup/${encodeURIComponent(code)}`,
      options ? { params: { companyCode: options.companyCode, branchId: options.branchId }, signal: options.signal } : {}
    );
    return result.data;
  },
  async lookupByPhone(phone: string, options?: WarrantyRequest) {
    const result = await apiFetch<{ success: boolean; data: PhoneWarrantyLookupResult }>(
      `/retail/warranty/lookup-phone/${encodeURIComponent(phone)}`,
      options ? { params: { companyCode: options.companyCode, branchId: options.branchId }, signal: options.signal } : {}
    );
    return result.data;
  },
  async expiring(scope: "supplier" | "customer", days = 30, options?: WarrantyRequest) {
    const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult[] }>(
      "/retail/warranty/expiring",
      { params: { scope, days, ...(options ? { companyCode: options.companyCode, branchId: options.branchId } : {}) }, signal: options?.signal }
    );
    return result.data;
  },
  async gapRisk(options?: WarrantyRequest) {
    const result = await apiFetch<{ success: boolean; data: WarrantyLookupResult[] }>(
      "/retail/warranty/gap-risk",
      options ? { params: { companyCode: options.companyCode, branchId: options.branchId }, signal: options.signal } : {}
    );
    return result.data;
  },
};
