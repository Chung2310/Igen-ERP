import type { RetailPaymentMethod } from "./cashier-shift.interface";
export type RetailOrderStatus = "draft" | "confirmed" | "completed" | "cancelled";
export type RetailPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export interface RetailOrderItem { productId: string; sku: string; productName: string; unit: string; category?: string; brand?: string; quantity: number; unitPrice: number; unitCost: number; discountAmount: number; lineTotal: number; trackingMode?: "none" | "quantity" | "unit_barcode" | "lot" | "serial"; serialNumbers?: string[]; internalBarcodes?: string[]; note?: string }
export interface RetailOrderPayment { method: RetailPaymentMethod; amount: number; tenderedAmount?: number; changeAmount?: number; reference?: string; paidAt: Date; receivedBy: string; receivedByName: string; shiftId: string; businessDate: string }
export interface RetailOrderRefund { method: RetailPaymentMethod; amount: number; reference?: string; refundedAt: Date; refundedBy: string; refundedByName: string; shiftId: string; businessDate: string; reason: string }
export interface IRetailOrder {
  orderCode?: string; companyCode: string; branchId: string; shiftId?: string; customerId?: string; customerName?: string; customerPhone?: string;
  items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; totalCost: number;
  payments: RetailOrderPayment[]; refunds: RetailOrderRefund[]; paidAmount: number; refundedAmount: number; dueAmount: number; paymentStatus: RetailPaymentStatus; dueDate?: Date;
  status: RetailOrderStatus; businessDate?: string; heldAt?: Date; heldSlot?: number; expiredBySystem?: boolean; confirmedAt?: Date; completedAt?: Date; cancelledAt?: Date; cancelReason?: string;
  salespersonId: string; salespersonName: string; createdBy: string; createdByName: string; stockApplied: boolean; stockRevertedAt?: Date; financeSettlementEventId?: string; version: number;
  createdAt?: Date; updatedAt?: Date;
}
