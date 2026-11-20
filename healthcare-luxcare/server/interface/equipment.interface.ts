import type { Document, Types } from "mongoose";

export type EquipmentStatus = "available" | "requested" | "in-use" | "maintenance" | "retired";
export type MedicalRiskClassification = "A" | "B" | "C" | "D";
export type InspectionResult = "pass" | "fail" | "conditional";
export type LegalDocumentType =
  | "invoice"
  | "co_cq"
  | "import_license"
  | "circulation_license"
  | "calibration_cert"
  | "manual"
  | "other";

export interface ILegalDocument {
  _id?: Types.ObjectId | string;
  title: string;
  type: LegalDocumentType;
  documentNumber?: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  issuedDate?: Date;
  expiryDate?: Date;
  issuingAuthority?: string;
  notes?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface IEquipment extends Document {
  companyCode: string;
  branchId?: string;
  name: string;
  code: string;
  imageUrl?: string;
  category: string;
  status: EquipmentStatus;
  roomId?: string;
  departmentId?: string;
  departmentName?: string;
  location?: string;
  purchaseDate?: Date;
  notes?: string;
  currentBorrowerId?: string;
  currentBorrowerName?: string;
  borrowedAt?: Date;
  expectedReturnAt?: Date;
  activeBorrowTransactionId?: string;

  // Hồ sơ pháp lý & Thông số kỹ thuật thiết bị y tế
  riskClassification?: MedicalRiskClassification;
  manufacturer?: string;
  originCountry?: string;
  modelNumber?: string;
  serialNumber?: string;
  usageStartDate?: Date;
  legalDocuments?: ILegalDocument[];

  // Quản lý kiểm định / hiệu chuẩn / bảo dưỡng
  inspectionCycleMonths?: number;
  lastInspectionDate?: Date;
  nextInspectionDate?: Date;
  lastInspectionResult?: InspectionResult;
  lastInspectionProvider?: string;
  lastInspectionReportUrl?: string;
  lastInspectionReportFileName?: string;
}

