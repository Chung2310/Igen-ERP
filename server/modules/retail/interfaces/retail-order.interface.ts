import type { RetailPaymentMethod } from "./cashier-shift.interface";
export type RetailOrderStatus = "draft" | "confirmed" | "completed" | "cancelled";
export type RetailPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export interface RetailOrderItem { variantId?: string; stockLedgerId?: string; stockWarehouseId?: string }
export interface RetailOrderItem { productId: string; sku: string; productName: string; unit: string; category?: string; brand?: string; quantity: number; unitPrice: number; unitCost: number; discountAmount: number; lineTotal: number; trackingMode?: "none" | "quantity" | "unit_barcode" | "lot" | "serial"; serialNumbers?: string[]; internalBarcodes?: string[]; soldAt?: Date; customerWarrantyStartAt?: Date; customerWarrantyEndAt?: Date; note?: string }
export interface RetailOrderPayment { recordedAt?: Date; settlementStatus?: "assigned" | "unassigned" | "reviewed"; reviewedBy?: string; reviewedAt?: Date; reviewReason?: string; pendingTransferAppliedAmount?: number; method: RetailPaymentMethod; amount: number; tenderedAmount?: number; changeAmount?: number; reference?: string; paidAt: Date; receivedBy: string; receivedByName: string; shiftId?: string; businessDate: string }
export interface RetailOrderRefund { method: RetailPaymentMethod; amount: number; reference?: string; refundedAt: Date; refundedBy: string; refundedByName: string; shiftId?: string; businessDate: string; reason: string }
export interface RetailOrderCustomerSnapshot { customerId: string; customerCode?: string; name: string; phone?: string }
export interface RetailOrderBillingSnapshot { legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string }
export interface IRetailOrder {
  createRequestKey?: string; createRequestFingerprint?: string; lastUpdateRequestKey?: string; lastUpdateRequestFingerprint?: string;
  retailPartnerId?: string; retailPartnerSnapshot?: { partnerId: string; code: string; name: string };
  manualOrderDiscount?: number; pointsToRedeem?: number; pointsRedeemed?: number; pointsDiscount?: number;
  salesChannel?: "tiktok-shop"; externalOrderId?: string; externalShopId?: string; externalShopCipher?: string; externalOrderStatus?: string;
  note?: string; installment?: { partner: string; months: number; prepayPercent: number; upfrontAmount?: number; financedAmount?: number }; cancelledByName?: string;
  afterSaleStatus?: string; restockReceiptId?: string; restockReceiptCode?: string;
  couponCode?: string; couponSnapshot?: { id: string; code: string; name: string; amount: number; version: number } | null;
  collaboratorId?: string; commissionSnapshot?: any;
  orderCode?: string; paymentCode?: string; pendingTransferAmount?: number; companyCode: string; branchId: string; shiftId?: string; customerId?: string; customerName?: string; customerPhone?: string; billingProfileId?: string; customerSnapshot?: RetailOrderCustomerSnapshot; billingSnapshot?: RetailOrderBillingSnapshot;
  items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; totalCost: number;
  payments: RetailOrderPayment[]; refunds: RetailOrderRefund[]; paidAmount: number; refundedAmount: number; dueAmount: number; paymentStatus: RetailPaymentStatus; dueDate?: Date;
  status: RetailOrderStatus; businessDate?: string; heldAt?: Date; heldSlot?: number; expiredBySystem?: boolean; confirmedAt?: Date; completedAt?: Date; cancelledAt?: Date; cancelReason?: string;
  salespersonId: string; salespersonName: string; createdBy: string; createdByName: string; stockApplied: boolean; stockRevertedAt?: Date; financeSettlementEventId?: string; version: number;
  createdAt?: Date; updatedAt?: Date;
}
