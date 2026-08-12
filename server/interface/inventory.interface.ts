import { Document } from "mongoose";

export type WarehouseKind = "selling" | "central" | "defective" | "warranty" | "other";
export type InventoryMovementDirection = "in" | "out";
export type InventoryMovementPurpose = "sale" | "cancel" | "purchase" | "sales-return" | "supplier-return" | "transfer" | "count" | "opening" | "other";
export type SupplierStatus = "active" | "inactive";
export type GoodsReceiptStatus = "draft" | "confirmed" | "cancelled";

export interface IWarehouse extends Document {
  companyCode: string;
  branchId: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IInventoryBalance extends Document {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  averageCost: number;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IInventoryLedgerEntry extends Document {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  direction: InventoryMovementDirection;
  purpose: InventoryMovementPurpose;
  quantity: number;
  quantityDelta: number;
  unitCost: number;
  unitPrice?: number;
  sourceType: string;
  sourceId: string;
  sourceCode?: string;
  sourceLine: number;
  idempotencyKey: string;
  operatorName: string;
  reason?: string;
  createdAt?: Date;
}

export interface ISupplier extends Document {
  companyCode: string;
  code: string;
  name: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  notes?: string;
  status: SupplierStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGoodsReceiptItem {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  note?: string;
}

export interface IGoodsReceipt extends Document {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  receiptCode: string;
  supplierId: string;
  supplierName: string;
  status: GoodsReceiptStatus;
  receivedAt?: Date;
  items: IGoodsReceiptItem[];
  subtotal: number;
  notes?: string;
  idempotencyKey?: string;
  createdBy: string;
  createdByName?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}
