import { model, Schema } from "mongoose";
import type { IEquipmentBorrowTransaction } from "../interface/equipment-borrow-transaction.interface";

const schema = new Schema<IEquipmentBorrowTransaction>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    equipmentId: { type: String, required: true, index: true },
    equipmentCode: { type: String, required: true },
    equipmentName: { type: String, required: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    requestType: { type: String, enum: ["borrow", "return"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    reason: String,
    note: String,
    expectedReturnAt: Date,
    borrowTransactionId: String,
    decidedBy: String,
    decidedByName: String,
    decidedAt: Date,
    rejectionReason: String,
    cancelledAt: Date,
  },
  { timestamps: true },
);

schema.index(
  { companyCode: 1, equipmentId: 1, requestType: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
schema.index({ companyCode: 1, branchId: 1, status: 1, createdAt: -1 });

export const EquipmentBorrowTransactionModel = model<IEquipmentBorrowTransaction>(
  "EquipmentBorrowTransaction",
  schema,
);
