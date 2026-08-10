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
