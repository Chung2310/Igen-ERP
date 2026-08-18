import { Document } from "mongoose";

export type WarehouseKind = "selling" | "central" | "defective" | "warranty" | "other";
export type InventoryMovementDirection = "in" | "out";
export type InventoryMovementPurpose = "sale" | "cancel" | "purchase" | "sales-return" | "supplier-return" | "transfer" | "count" | "count_adjustment" | "opening" | "other";
export type SupplierStatus = "active" | "inactive";
export type GoodsReceiptStatus = "draft" | "pending" | "receiving" | "confirmed" | "cancelled";
export type InventoryCountStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled" | "conflict";

export interface IInventoryCountItem {
  _id?: string;
  productId: string;
  variantId?: string;
  sku: string;
  barcode?: string;
  productName: string;
  systemQuantity: number;
  countedQuantity: number;
  quantityDelta: number;
  sourceBalanceVersion: number;
  /** SKU theo dõi từng đơn vị thì đếm bằng cách quét mã nội bộ/IMEI, không gõ số lượng. */
  trackingMode?: "none" | "quantity" | "unit_barcode" | "lot" | "serial";
  /** Máy hệ thống ghi đang nằm trong kho tại lúc tạo phiếu. */
  expectedUnits?: Array<{ serialUnitId: string; internalBarcode?: string; serialNumber?: string }>;
  /** Máy thực tế quét được, là tập con của expectedUnits. */
  scannedUnitIds?: string[];
  note?: string;
}

/** Mã quét được nhưng không thuộc kho đang kiểm — giữ lại để người duyệt xử lý. */
export interface IInventoryCountUnexpectedScan {
  code: string;
  reason: "other_warehouse" | "sold" | "unknown" | "wrong_status";
  serialUnitId?: string;
  sku?: string;
  productName?: string;
  warehouseId?: string;
  status?: string;
  scannedAt: Date;
}

export interface IInventoryCount extends Document {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  countCode: string;
  status: InventoryCountStatus;
  items: IInventoryCountItem[];
  unexpectedScans?: IInventoryCountUnexpectedScan[];
  notes?: string;
  createdBy: string;
  submittedBy?: string;
  approvedBy?: string;
  createdAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  cancelledAt?: Date;
  version: number;
}

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
  minStock?: number;
  maxStock?: number;
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
  barcode?: string;
  sku: string;
  trackingMode?: "none" | "quantity" | "unit_barcode" | "lot" | "serial";
  serialNumbers?: string[];
  unitDetails?: Array<{ internalBarcode: string; serialNumber?: string; imei1?: string; imei2?: string }>;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  /** Số tháng bảo hành nhà cung cấp chốt tại thời điểm nhập; mặc định lấy từ SKU. */
  supplierWarrantyMonths?: number;
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
