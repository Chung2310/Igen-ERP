export type RetailScope = { companyCode: string; branchId: string };

export interface RetailSettings {
  companyCode: string;
  branchId: string;
  allowNegativeStock: boolean;
  maxDiscountPercent: number;
  defaultTaxRate: number;
  varianceReasonThreshold: number;
  orderPrefix: string;
  invoicePrefix: string;
}

export interface RetailCustomer {
  _id: string;
  customerCode: string;
  companyCode: string;
  originBranchId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface RetailCustomerDetail {
  customer: RetailCustomer;
  summary: { totalSales: number; totalCollected: number; currentDebt: number };
  orders: unknown[];
  payments: unknown[];
}

export interface RetailProduct { _id: string; sku: string; barcode?: string; name: string; category: string; brand?: string; unit: string; stock: number; price: number; imageUrl?: string }
export interface RetailOrderItem { productId: string; sku: string; productName: string; unit: string; quantity: number; unitPrice: number; discountAmount: number; lineTotal: number }
export interface RetailPaymentInput { method: "cash" | "card" | "transfer" | "ewallet"; amount: number; tenderedAmount?: number; reference?: string }
export interface RetailOrder { _id: string; orderCode?: string; status: "draft" | "confirmed" | "completed" | "cancelled"; paymentStatus: "unpaid" | "partial" | "paid" | "refunded"; businessDate?: string; customerId?: string; customerName?: string; items: RetailOrderItem[]; grandTotal: number; paidAmount: number; refundedAmount?: number; dueAmount: number; version: number; createdBy: string; createdByName: string }
export interface RetailInvoice { _id: string; invoiceNo: string; orderId: string; orderCode: string; issuedAt: string; status: "issued" | "void"; snapshot: { customerName: string; customerPhone?: string; items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxAmount: number; grandTotal: number; amountInWords: string } }
export interface RetailShift { _id: string; shiftCode: string; cashierId: string; cashierName: string; openingFloat: number; businessDate: string; status: "open" | "closed" | "reconciled"; expectedCash?: number; countedCash?: number; varianceAmount?: number; varianceReason?: string; grossSales?: number; collectedAmount?: number; refundedAmount?: number }
