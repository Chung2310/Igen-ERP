export type SerialUnitStatus = "in_stock" | "sold" | "returned" | "defective" | "repairing" | "scrapped";

export interface ISerialUnit {
  companyCode: string;
  branchId: string;
  warehouseId?: string;
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  internalBarcode: string;
  normalizedInternalBarcode: string;
  serialNumber: string;
  normalizedSerialNumber: string;
  status: SerialUnitStatus;
  currentDocumentType?: string;
  currentDocumentId?: string;
  customerId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
