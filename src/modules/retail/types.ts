export type RetailScope = { companyCode: string; branchId: string };

export interface RetailSettings {
  companyCode: string;
  branchId: string;
  customerTiers: Array<{ code: string; name: string; minSpend: number }>;
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
  tier?: { code: string; name: string; minSpend: number };
}

export interface RetailCustomerDetail {
  customer: RetailCustomer;
  summary: { totalSales: number; totalCollected: number; currentDebt: number; tier: { code: string; name: string; minSpend: number } };
  tierHistory: Array<{ _id: string; fromTierName?: string; toTierName: string; totalSales: number; changedAt: string }>;
  orders: unknown[];
  payments: unknown[];
}

export interface RetailProduct { _id: string; sku: string; barcode?: string; name: string; category: string; brand?: string; unit: string; stock: number; price: number; imageUrl?: string }
export type RetailDiscountInput = { type: "amount" | "percent"; value: number };
export interface RetailOrderItemInput { productId: string; quantity: number; discount: RetailDiscountInput }
export interface RetailOrderInput { items: RetailOrderItemInput[]; customerId?: string; orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number; dueDate?: string }
export interface RetailOrderItem { productId: string; sku: string; productName: string; unit: string; quantity: number; unitPrice: number; discountAmount: number; lineTotal: number }
export interface RetailPaymentInput { method: "cash" | "card" | "transfer" | "ewallet"; amount: number; tenderedAmount?: number; reference?: string }
export interface RetailOrder { _id: string; orderCode?: string; status: "draft" | "confirmed" | "completed" | "cancelled"; paymentStatus: "unpaid" | "partial" | "paid" | "refunded"; businessDate?: string; customerId?: string; customerName?: string; customerPhone?: string; items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; paidAmount: number; refundedAmount?: number; dueAmount: number; version: number; createdBy: string; createdByName: string }
export interface RetailInvoice { _id: string; invoiceNo: string; orderId: string; orderCode: string; issuedAt: string; status: "issued" | "void"; snapshot: { customerName: string; customerPhone?: string; cashierName: string; businessDate?: string; items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; payments: Array<{ method: string; amount: number; tenderedAmount?: number; changeAmount?: number; reference?: string }>; amountInWords: string } }
export interface RetailOrderResult { order: RetailOrder; invoice: RetailInvoice }
export interface RetailShift { _id: string; shiftCode: string; cashierId: string; cashierName: string; openingFloat: number; businessDate: string; status: "open" | "closed" | "reconciled"; expectedCash?: number; countedCash?: number; varianceAmount?: number; varianceReason?: string; grossSales?: number; collectedAmount?: number; refundedAmount?: number }

export type RetailReportFilters =
  | { preset: "7d" | "30d"; from?: never; to?: never }
  | { preset?: never; from: string; to: string }
  | { preset?: never; from?: never; to?: never };

export interface RetailReport {
  range: { from: string; to: string };
  summary: {
    grossSales: number;
    refunds: number;
    netSales: number;
    orderCount: number;
    averageOrderValue: number;
    collectedAmount: number;
    dueAmount: number;
    totalCost?: number;
    grossProfit?: number;
    grossMarginPercent?: number;
  };
  timeSeries: Array<{
    businessDate: string;
    grossSales: number;
    refunds: number;
    netSales: number;
    collectedAmount: number;
    orderCount: number;
  }>;
  paymentMix: Array<{ method: RetailPaymentInput["method"]; amount: number }>;
  cashiers: Array<{
    cashierId: string;
    cashierName: string;
    orderCount: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    averageOrderValue: number;
  }>;
  shifts: Array<{
    shiftId: string;
    shiftCode: string;
    businessDate: string;
    cashierId: string;
    cashierName: string;
    status: string;
    grossSales: number;
    collectedAmount: number;
    refundedAmount: number;
    varianceAmount?: number;
  }>;
  debt: {
    totalDebt: number;
    overdueDebt: number;
    dueTodayDebt: number;
    upcomingDebt: number;
    customers: Array<{
      customerId: string;
      customerName: string;
      customerPhone?: string;
      totalDebt: number;
      overdueDebt: number;
      nearestDueDate?: string;
      orderCount: number;
    }>;
  };
}
