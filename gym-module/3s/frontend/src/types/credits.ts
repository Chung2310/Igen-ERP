import type { PaginationMeta } from '../types';

export type PaymentGateway = 'SEPAY' | 'PAYOS' | 'VNPAY' | 'MOMO';
export interface CreditWallet {
  id: string;
  availableCredits: number;
  reservedCredits: number;
}
export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  amountVnd: number;
  baseCredits: number;
  bonusCredits: number;
  grantCredits: number;
  active?: boolean;
  sortOrder?: number;
}
export interface CreditLedgerEntry {
  _id: string;
  type: 'TOPUP' | 'RESERVE' | 'SETTLE' | 'RELEASE' | 'ADJUSTMENT';
  availableDelta: number;
  reservedDelta: number;
  availableAfter: number;
  reservedAfter: number;
  reason: string;
  createdAt: string;
}
export interface PaymentOrder {
  id: string;
  orderCode: string;
  gateway: PaymentGateway;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  source: 'PACKAGE' | 'CUSTOM';
  amountVnd: number;
  baseCredits: number;
  bonusCredits: number;
  grantCredits: number;
  expiresAt: string;
  redirectUrl?: string;
  qrCodeUrl?: string;
  bankTransfer?: { bankName: string; accountNumber: string; accountHolder: string; content: string };
}
export interface GatewayAvailability {
  SEPAY?: boolean;
  PAYOS?: boolean;
  VNPAY?: boolean;
  MOMO?: boolean;
}
export interface CreditPackageResponse {
  vndPerCredit?: number | null;
  packages: CreditPackage[];
  gateways: GatewayAvailability;
}
export interface CreditPricingPolicy {
  taskType: string;
  enabled: boolean;
  maxReservationCredits: number;
  fallbackCredits: number;
  markupBasisPoints: number;
  minBillableCredits: number;
}
export interface CreditPricingAdmin {
  vndPerCredit: number;
  usdToVnd: number;
  policies: CreditPricingPolicy[];
}
export interface PaginatedCredits<T> {
  items: T[];
  meta?: PaginationMeta;
}
