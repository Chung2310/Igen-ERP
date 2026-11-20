import { model, Schema } from "mongoose";
import type { ISupplyTransaction } from "../interface/supply.interface";

const schema = new Schema<ISupplyTransaction>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    supplyId: { type: String, required: true, index: true },
    supplyCode: { type: String, required: true },
    supplyName: { type: String, required: true },
    type: { type: String, enum: ["in", "out"], required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    performerId: { type: String, required: true, index: true },
    performerName: { type: String, required: true },
    recipientDepartment: { type: String, trim: true },
    reason: { type: String, trim: true },
    batchNumber: { type: String, trim: true },
    expiryDate: Date,
    batchCode: { type: String, trim: true, index: true },
    supplier: { type: String, trim: true },
    unitPrice: { type: Number, min: 0 },
  },
  { timestamps: true },
);

schema.index({ companyCode: 1, supplyId: 1, createdAt: -1 });
schema.index({ companyCode: 1, branchId: 1, type: 1, createdAt: -1 });
schema.index({ companyCode: 1, batchCode: 1, createdAt: -1 });

export const SupplyTransactionModel = model<ISupplyTransaction>("SupplyTransaction", schema);
