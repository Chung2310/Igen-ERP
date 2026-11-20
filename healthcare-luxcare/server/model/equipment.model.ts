import { model, Schema, Types } from "mongoose";
import type { IEquipment, ILegalDocument } from "../interface/equipment.interface";


const legalDocumentSchema = new Schema<ILegalDocument>(
  {
    _id: {
      type: Schema.Types.Mixed,
      default: () => new Types.ObjectId(),
    },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["invoice", "co_cq", "import_license", "circulation_license", "calibration_cert", "manual", "other"],
      required: true,
      default: "other",
    },
    documentNumber: { type: String, trim: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    issuedDate: { type: Date },
    expiryDate: { type: Date },
    issuingAuthority: { type: String, trim: true },
    notes: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String },
  },
  { _id: true },
);

const schema = new Schema<IEquipment>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    status: { type: String, enum: ["available", "requested", "in-use", "maintenance", "retired"], default: "available" },
    roomId: { type: String, index: true },
    departmentId: { type: String, index: true },
    departmentName: { type: String, trim: true },
    location: String,
    purchaseDate: Date,
    notes: String,
    currentBorrowerId: { type: String, index: true },
    currentBorrowerName: String,
    borrowedAt: Date,
    expectedReturnAt: Date,
    activeBorrowTransactionId: { type: String, index: true },

    // Hồ sơ pháp lý & Thông số kỹ thuật thiết bị y tế
    riskClassification: {
      type: String,
      enum: ["A", "B", "C", "D", null, ""],
      set: (v: any) => (v === "" ? null : v),
      index: true,
    },
    manufacturer: { type: String, trim: true },
    originCountry: { type: String, trim: true },
    modelNumber: { type: String, trim: true },
    serialNumber: { type: String, trim: true, index: true },
    usageStartDate: Date,
    legalDocuments: [legalDocumentSchema],

    // Quản lý kiểm định / hiệu chuẩn / bảo dưỡng
    inspectionCycleMonths: { type: Number, min: 1 },
    lastInspectionDate: Date,
    nextInspectionDate: { type: Date, index: true },
    lastInspectionResult: {
      type: String,
      enum: ["pass", "fail", "conditional", null, ""],
      set: (v: any) => (v === "" ? null : v),
    },
    lastInspectionProvider: { type: String, trim: true },
    lastInspectionReportUrl: String,
    lastInspectionReportFileName: String,
  },
  { timestamps: true },
);
schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, nextInspectionDate: 1 });
schema.index({ companyCode: 1, riskClassification: 1 });
export const EquipmentModel = model<IEquipment>("Equipment", schema);

