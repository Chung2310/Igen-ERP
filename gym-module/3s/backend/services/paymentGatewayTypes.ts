export interface GatewayCreateInput {
  orderCode: string;
  requestId?: string;
  amountVnd: number;
  description: string;
  ipAddress?: string;
  createdAt?: Date;
}

export type GatewayPaymentResult =
  | { configured: false }
  | { configured: true; redirectUrl: string; qrCode?: string; paymentLinkId?: string };

export interface GatewayCallbackResult {
  recipient?: { bankName: string; accountNumber: string; subAccount: string };
  valid: boolean;
  orderCode?: string;
  paymentCode?: string;
  amountVnd?: number;
  transactionId?: string;
  resultCode?: string;
  success?: boolean;
}
