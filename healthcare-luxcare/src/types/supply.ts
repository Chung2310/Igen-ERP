export type SupplyStatus = "in-stock" | "low-stock" | "out-of-stock" | "expired" | "quarantined";

export interface SupplyDocument {
  name: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export interface SupplyItem {
  _id: string;
  companyCode: string;
  branchId?: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  quantity: number;
  availableQuantity?: number;
  minQuantity: number;
  expiryDate: string | null;
  requiresExpiry?: boolean;
  isActive?: boolean;
  manufactureDate?: string;
  batchNumber?: string;
  warehouseLocation: string;
  warehouseId?: string;
  roomId?: string;
  supplier: string;
  supplierId?: string;
  inspectionDate: string;
  nextInspectionDate?: string;
  inspectionCertificateNumber?: string;
  imageUrl?: string;
  images?: string[];
  documents: SupplyDocument[];
  unitPrice?: number;
  notes?: string;
  status: SupplyStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplyTransaction {
  _id: string;
  supplyId: string;
  supplyCode: string;
  supplyName: string;
  type: "in" | "out";
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  performerId: string;
  performerName: string;
  recipientDepartment?: string;
  reason?: string;
  batchNumber?: string;
  expiryDate?: string;
  batchCode?: string;
  supplier?: string;
  unitPrice?: number;
  createdAt: string;
}

export interface SupplyTransactionDocument {
  _id: string;
  voucherId?: string;
  batchCode?: string;
  type: "in" | "out";
  status: "draft" | "completed";
  createdAt: string;
  performerId: string;
  performerName: string;
  recipientDepartment?: string;
  reason?: string;
  supplier?: string;
  warehouseLocation?: string;
  totalQuantity: number;
  totalValue: number;
  items: SupplyTransaction[];
}

export interface BatchStockLineItem {
  supplyId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  unitPrice?: number;
  notes?: string;
}

export interface BatchStockPayload {
  type: "in" | "out";
  batchCode?: string;
  supplier?: string;
  warehouseLocation?: string;
  recipientDepartment?: string;
  reason: string;
  branchId?: string;
  items: BatchStockLineItem[];
}

export interface BatchStockResponse {
  status: string;
  message: string;
  data: {
    batchCode: string;
    type: "in" | "out";
    totalItems: number;
    totalQuantity: number;
    transactions: SupplyTransaction[];
    supplies: SupplyItem[];
  };
}

export interface SupplyStats {
  totalValue: number;
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
}

export interface SupplyTransactionStats {
  totalInQty: number;
  totalInCount: number;
  totalOutQty: number;
  totalOutCount: number;
}

export interface AllTransactionsResponse {
  data: SupplyTransactionDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: SupplyTransactionStats;
}
