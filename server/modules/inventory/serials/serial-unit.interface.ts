export type SerialUnitStatus = "in_stock" | "in_transit" | "internal_use" | "sold" | "returned" | "defective" | "repairing" | "scrapped" | "lost";
export interface SupplierWarranty { supplierId: string; supplierName: string; receiptId: string; receiptCode: string; months: number; startAt: Date; startSource: "receipt" | "manual"; endAt: Date }
export interface CustomerWarranty { months: number; startAt: Date; endAt: Date; source: "variant" | "manual" | "inherited"; inheritedFromSerialUnitId?: string }

export interface ISerialUnit {
  companyCode: string;
  branchId: string;
  warehouseId?: string;
  transferToBranchId?: string;
  transferToWarehouseId?: string;
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  internalBarcode: string;
  normalizedInternalBarcode: string;
  globalBarcodeKey?: string;
  barcodeAliases?: string[];
  normalizedBarcodeAliases?: string[];
  serialNumber: string;
  normalizedSerialNumber: string;
  imei1?: string;
  imei2?: string;
  normalizedImeis?: string[];
  status: SerialUnitStatus;
  internalUse?: { recipientName: string; issuedAt: Date; stockLogId: string; unitCost: number };
  currentDocumentType?: string;
  currentDocumentId?: string;
  customerId?: string;
  supplierWarranty?: SupplierWarranty;
  customerWarranty?: CustomerWarranty;
  soldAt?: Date;
  soldOrderId?: string;
  soldOrderCode?: string;
  soldInvoiceId?: string;
  soldBranchId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
