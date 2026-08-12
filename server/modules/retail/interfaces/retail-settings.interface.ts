export interface RetailSettingsValues {
  customerTiers: Array<{ code: string; name: string; minSpend: number }>;
  allowNegativeStock: boolean;
  maxDiscountPercent: number;
  defaultTaxRate: number;
  varianceReasonThreshold: number;
  orderPrefix: string;
  invoicePrefix: string;
}

export interface IRetailSettings extends RetailSettingsValues {
  companyCode: string;
  branchId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
