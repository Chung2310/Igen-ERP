import { model, Schema, Types, type Document } from "mongoose";
import type { InspectionResult } from "../interface/equipment.interface";

export type EquipmentInspectionType = "inspection" | "calibration" | "maintenance";

export interface IEquipmentInspectionRecord extends Document {
  companyCode: string;
  branchId?: string;
  equipmentId: Types.ObjectId | string;
  type: EquipmentInspectionType;
  performedDate: Date;
  nextDueDate: Date;
  serviceProvider: string;
  inspectorName?: string;
  result: InspectionResult;
  certificateNumber?: string;
  reportFileUrl?: string;
  reportFileName?: string;
  cost?: number;
  notes?: string;
  performedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const equipmentInspectionSchema = new Schema<IEquipmentInspectionRecord>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", required: true, index: true },
    type: {
      type: String,
      enum: ["inspection", "calibration", "maintenance"],
      required: true,
      default: "inspection",
    },
    performedDate: { type: Date, required: true },
    nextDueDate: { type: Date, required: true },
    serviceProvider: { type: String, required: true, trim: true },
    inspectorName: { type: String, trim: true },
    result: {
      type: String,
      enum: ["pass", "fail", "conditional"],
      required: true,
      default: "pass",
    },
    certificateNumber: { type: String, trim: true },
    reportFileUrl: { type: String, trim: true },
    reportFileName: { type: String, trim: true },
    cost: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    performedByUserId: { type: String, index: true },
  },
  { timestamps: true },
);

equipmentInspectionSchema.index({ companyCode: 1, equipmentId: 1, performedDate: -1 });

export const EquipmentInspectionModel = model<IEquipmentInspectionRecord>(
  "EquipmentInspection",
  equipmentInspectionSchema,
);
