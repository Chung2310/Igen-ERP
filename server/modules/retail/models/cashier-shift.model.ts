import { model, Schema } from "mongoose";
import type { ICashierShift } from "../interfaces/cashier-shift.interface";

const CashMovementSchema = new Schema({ type: { type: String, enum: ["in", "out"], required: true }, amount: { type: Number, min: 1, required: true }, reason: { type: String, required: true, trim: true }, at: { type: Date, required: true }, by: { type: String, required: true }, byName: { type: String, required: true } }, { _id: false });
const MethodTotalSchema = new Schema({ method: { type: String, enum: ["cash", "card", "transfer", "ewallet"], required: true }, collectedAmount: { type: Number, min: 0, default: 0 }, refundedAmount: { type: Number, min: 0, default: 0 } }, { _id: false });
const CashierShiftSchema = new Schema<ICashierShift>({
  shiftCode: { type: String, required: true }, companyCode: { type: String, required: true, index: true }, branchId: { type: String, required: true, index: true }, terminalId: { type: String, trim: true },
  cashierId: { type: String, required: true, index: true }, cashierName: { type: String, required: true }, openingFloat: { type: Number, min: 0, required: true }, openedAt: { type: Date, required: true }, openedBy: { type: String, required: true },
  cashMovements: { type: [CashMovementSchema], default: [] }, grossSales: { type: Number, min: 0, default: 0 }, collectedAmount: { type: Number, min: 0, default: 0 }, newDebtAmount: { type: Number, min: 0, default: 0 }, refundedAmount: { type: Number, min: 0, default: 0 }, netCollectedAmount: { type: Number, default: 0 }, methodTotals: { type: [MethodTotalSchema], default: [] }, expectedCash: { type: Number, min: 0, default: 0 },
  countedCash: { type: Number, min: 0 }, varianceAmount: { type: Number }, varianceReason: { type: String, trim: true }, status: { type: String, enum: ["open", "closed", "reconciled"], required: true, default: "open", index: true }, businessDate: { type: String, required: true, index: true }, closedAt: Date, closedBy: String, approvedBy: String, approvedByName: String, approvedAt: Date,
}, { timestamps: true });
CashierShiftSchema.index({ companyCode: 1, branchId: 1, cashierId: 1 }, { unique: true, partialFilterExpression: { status: "open" } });
CashierShiftSchema.index({ companyCode: 1, branchId: 1, terminalId: 1 }, { unique: true, partialFilterExpression: { status: "open", terminalId: { $type: "string" } } });
CashierShiftSchema.index({ companyCode: 1, shiftCode: 1 }, { unique: true });
export const CashierShiftModel = model<ICashierShift>("CashierShift", CashierShiftSchema);
