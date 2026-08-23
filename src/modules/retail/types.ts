export type RetailScope = { companyCode: string; branchId: string };
export interface RetailOfflineSyncResult { itemId: string; status: "synced" | "failed"; orderId?: string; invoiceId?: string; error?: string }

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
  invoicePaperSize: "A4" | "A5" | "80mm";
  invoiceTemplate: "standard";
}

export interface RetailCustomer {
  _id: string;
  customerCode: string;
  companyCode: string;
  type?: "regular" | "vat";
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  tier?: { code: string; name: string; minSpend: number };
}

export interface RetailCustomerBillingProfile {
  _id: string;
  customerId: string;
  legalName: string;
  taxId: string;
  address: string;
  invoiceEmail: string;
  contactName?: string;
  isDefault: boolean;
  status: "active" | "inactive";
  version: number;
}

export interface RetailCustomerDetail {
  customer: RetailCustomer;
  summary: { totalSales: number; totalCollected: number; currentDebt: number; tier: { code: string; name: string; minSpend: number } };
  tierHistory: Array<{ _id: string; fromTierName?: string; toTierName: string; totalSales: number; changedAt: string }>;
  orders: unknown[];
  payments: unknown[];
}

export interface RetailProduct { _id: string; productId?: string; sku: string; variantName?: string; barcode?: string; name: string; category: string; brand?: string; unit: string; stock: number; price: number; imageUrl?: string; trackingMode?: "none" | "quantity" | "unit_barcode" | "lot" | "serial"; variantId?: string; matchedSerialNumber?: string; matchedInternalBarcode?: string }
export type RetailDiscountInput = { type: "amount" | "percent"; value: number };
export interface RetailOrderItemInput { productId: string; quantity: number; discount: RetailDiscountInput; trackingMode?: RetailProduct["trackingMode"]; serialNumbers?: string[]; internalBarcodes?: string[] }
export interface RetailOrderInput { items: RetailOrderItemInput[]; customerId?: string; billingProfileId?: string; orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number; dueDate?: string }
export interface RetailOrderItem { productId: string; variantId?: string; sku: string; productName: string; unit: string; quantity: number; unitPrice: number; unitCost?: number; discountAmount: number; lineTotal: number; trackingMode?: RetailProduct["trackingMode"]; serialNumbers?: string[]; internalBarcodes?: string[]; soldAt?: string; customerWarrantyStartAt?: string; customerWarrantyEndAt?: string }
export interface RetailPaymentInput { method: "cash" | "card" | "transfer" | "ewallet"; amount: number; tenderedAmount?: number; reference?: string }
export interface RetailOrder { _id: string; orderCode?: string; status: "draft" | "confirmed" | "completed" | "cancelled"; paymentStatus: "unpaid" | "partial" | "paid" | "refunded"; businessDate?: string; customerId?: string; customerName?: string; customerPhone?: string; billingProfileId?: string; customerSnapshot?: { customerId: string; customerCode?: string; name: string; phone?: string }; billingSnapshot?: { legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string }; items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; paidAmount: number; refundedAmount?: number; dueAmount: number; version: number; createdBy: string; createdByName: string }
export interface RetailStoreSnapshot { legalName: string; taxCode?: string; storeName: string; branchCode: string; branchName: string; branchAddress?: string; branchPhone?: string }
export interface RetailInvoice { _id: string; invoiceNo: string; orderId: string; orderCode: string; issuedAt: string; status: "issued" | "void"; snapshot: { store?: RetailStoreSnapshot; customerName: string; customerPhone?: string; customerSnapshot?: { customerId: string; customerCode?: string; name: string; phone?: string }; billingSnapshot?: { legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string }; cashierName: string; businessDate?: string; items: RetailOrderItem[]; subtotal: number; orderDiscount: number; taxRate: number; taxAmount: number; shippingFee: number; grandTotal: number; paidAmount?: number; dueAmount?: number; paymentStatus?: "unpaid" | "partial" | "paid" | "refunded"; payments: Array<{ method: string; amount: number; tenderedAmount?: number; changeAmount?: number; reference?: string }>; amountInWords: string } }
export interface RetailOrderResult { order: RetailOrder; invoice: RetailInvoice }
export interface RetailPaymentQr { orderId: string; orderCode: string; paymentCode: string; amount: number; paymentStatus: RetailOrder["paymentStatus"]; accountNumber: string; accountName: string; bankId: string; qrUrl: string }
export type RetailAfterSaleType = "return" | "buyback";
export interface RetailAfterSaleItemInput { orderLineIndex: number; quantity: number; unitAmount?: number; condition: "like_new" | "good" | "fair" | "poor"; serialNumbers?: string[]; internalBarcodes?: string[]; note?: string }
export interface RetailAfterSaleInput { type: RetailAfterSaleType; orderId: string; items: RetailAfterSaleItemInput[]; paymentMethod: RetailPaymentInput["method"]; paymentReference?: string; reason: string; idempotencyKey: string }
export interface RetailAfterSale { _id: string; code: string; type: RetailAfterSaleType; orderId: string; orderCode: string; customerName?: string; items: Array<RetailAfterSaleItemInput & { sku: string; productName: string; lineAmount: number }>; totalAmount: number; paymentMethod: RetailPaymentInput["method"]; reason: string; businessDate: string; createdAt: string }
export interface RetailReceivableEntry { _id: string; type: "charge" | "payment" | "adjustment" | "reversal"; amount: number; signedAmount: number; runningBalance: number; reason?: string; orderId?: string; reversesEntryId?: string; createdAt: string; createdByName?: string }
export interface RetailShift { _id: string; shiftCode: string; cashierId: string; cashierName: string; openingFloat: number; businessDate: string; status: "open" | "closed" | "reconciled"; openedAt?: string; closedAt?: string; operationalEndsAt?: string; expectedCash?: number; countedCash?: number; varianceAmount?: number; varianceReason?: string; grossSales?: number; collectedAmount?: number; refundedAmount?: number; netCollectedAmount?: number; methodTotals?: Array<{ method: RetailPaymentInput["method"]; collectedAmount: number; refundedAmount: number }> }

type RetailReportRangeFilters =
  | { preset: "7d" | "30d"; from?: never; to?: never }
  | { preset?: never; from: string; to: string }
  | { preset?: never; from?: never; to?: never };
export type RetailReportFilters = RetailReportRangeFilters & { salespersonId?: string; productId?: string; sku?: string; category?: string; brand?: string };
export interface RetailProductReportRow { productId: string; sku: string; productName: string; category?: string; brand?: string; netQuantity: number; netSales: number; profit?: number }
export interface RetailAnalyticsReconciliation { retailNetSales: number; analyticsNetSales: number; difference: number; matched: boolean }

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
  products: RetailProductReportRow[];
  slowProducts: RetailProductReportRow[];
  analyticsReconciliation?: RetailAnalyticsReconciliation;
}
export interface RetailCustomerTierHistory { _id: string; fromTierName?: string; toTierName: string; toTierCode?: string; totalSales: number; source?: "automatic" | "manual"; reason?: string; effectiveFrom?: string; effectiveTo?: string; actorName?: string; changedAt: string }
