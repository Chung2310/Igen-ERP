import type { PaginationMeta } from '../types';
import type { CreditLedgerEntry, CreditPackage, CreditPackageResponse, CreditPricingAdmin, CreditWallet, PaymentGateway, PaymentOrder } from '../types/credits';
import { api } from './api';
import { ApiError } from './api';

export function creditErrorAction(error: unknown) {
  return error instanceof ApiError && error.code === 'INSUFFICIENT_CREDITS'
    ? { message: error.message, href: '/wallet', label: 'Nạp credit' }
    : null;
}

export const creditsService = {
  wallet: async () => (await api.get<CreditWallet>('/api/credits/me')).data,
  packages: async () => (await api.get<CreditPackageResponse>('/api/credits/packages')).data,
  ledger: async (page = 1, type = '') => { const response = await api.get<CreditLedgerEntry[]>(`/api/credits/me/ledger?page=${page}&limit=20${type ? `&type=${type}` : ''}`); return { items: response.data, meta: response.meta }; },
  createTopup: async (body: { gateway: PaymentGateway; packageId?: string; customAmountVnd?: number }) => (await api.post<PaymentOrder>('/api/credits/topups', body)).data,
  order: async (id: string) => (await api.get<PaymentOrder>(`/api/credits/topups/${id}`)).data,
  adminPricing: async () => (await api.get<CreditPricingAdmin>('/api/admin/credit-pricing')).data,
  updateAdminPricing: async (body: CreditPricingAdmin) => (await api.patch<CreditPricingAdmin>('/api/admin/credit-pricing', body)).data,
  adminPackages: async () => (await api.get<CreditPackage[]>('/api/admin/credit-packages')).data,
  createAdminPackage: async (body: Omit<CreditPackage, 'id' | 'baseCredits' | 'grantCredits'>) => (await api.post<CreditPackage>('/api/admin/credit-packages', body)).data,
  updateAdminPackage: async (id: string, body: Partial<CreditPackage>) => (await api.patch<CreditPackage>(`/api/admin/credit-packages/${id}`, body)).data,
  deleteAdminPackage: async (id: string) => api.delete(`/api/admin/credit-packages/${id}`),
  adjust: async (body: { userId: string; credits: number; reason: string }) => (await api.post<CreditWallet>('/api/admin/credit-adjustments', body)).data,
  adminList: async (path: 'payment-orders' | 'ai-usage' | 'credit-ledger' | 'credit-shortfalls', page = 1) => { const response = await api.get<Record<string, unknown>[]>(`/api/admin/${path}?page=${page}&limit=20`); return { items: response.data, meta: response.meta as PaginationMeta | undefined }; },
};
