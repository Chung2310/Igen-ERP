import type { Document } from "mongoose";

export type SupplyStatus = "in-stock" | "low-stock" | "out-of-stock" | "expired" | "quarantined";

export interface ISupplyDocument {
  name: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt?: Date;
}

export interface ISupply extends Document {
  companyCode: string;
  branchId?: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  expiryDate: Date | null;
  requiresExpiry: boolean;
  isActive: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  catalogCreation?: {
    actorId: string;
    key?: string;
    fingerprint: string;
    snapshot: Record<string, any>;
  };
  manufactureDate?: Date;
  batchNumber?: string;
  warehouseLocation: string;
  warehouseId?: string;
  roomId?: string;
  supplier: string;
  supplierId?: string;
  inspectionDate: Date;
  nextInspectionDate?: Date;
  inspectionCertificateNumber?: string;
  imageUrl?: string;
  images?: string[];
  documents: ISupplyDocument[];
  unitPrice?: number;
  notes?: string;
  status: SupplyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type SupplyTransactionType = "in" | "out";

export interface ISupplyTransaction extends Document {
  companyCode: string;
  branchId?: string;
  supplyId: string;
  supplyCode: string;
  supplyName: string;
  type: SupplyTransactionType;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  performerId: string;
  performerName: string;
  recipientDepartment?: string;
  reason?: string;
  batchNumber?: string;
  expiryDate?: Date;
  batchCode?: string;
  supplier?: string;
  unitPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}
