export type RetailInvoicePaperSize = "A4" | "A5" | "80mm";
export type RetailInvoiceTemplate = "standard";
export type RetailTierEvaluationWindow = { type: "lifetime" } | { type: "rolling12Months" } | { type: "custom"; from: string; to: string };

export interface RetailSettingsValues {
  customerTiers: Array<{ code: string; name: string; minSpend: number }>;
  tierEvaluationWindow: RetailTierEvaluationWindow;
  allowNegativeStock: boolean;
  maxDiscountPercent: number;
  defaultTaxRate: number;
  varianceReasonThreshold: number;
  orderPrefix: string;
  invoicePrefix: string;
  invoicePaperSize: RetailInvoicePaperSize;
  invoiceTemplate: RetailInvoiceTemplate;
}

export interface IRetailSettings extends RetailSettingsValues {
  companyCode: string;
  branchId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
