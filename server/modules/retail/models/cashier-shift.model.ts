import { model, Schema } from "mongoose";
import type { ICashierShift } from "../interfaces/cashier-shift.interface";

const CashMovementSchema = new Schema({ key: String, idempotencyKey: String, reversesKey: String, type: { type: String, enum: ["in", "out"], required: true }, amount: { type: Number, min: 1, required: true }, reason: { type: String, required: true, trim: true }, at: { type: Date, required: true }, by: { type: String, required: true }, byName: { type: String, required: true } }, { _id: false });
const MethodTotalSchema = new Schema({ method: { type: String, enum: ["cash", "card", "transfer", "ewallet"], required: true }, collectedAmount: { type: Number, min: 0, default: 0 }, refundedAmount: { type: Number, min: 0, default: 0 } }, { _id: false });
const CashierShiftSchema = new Schema<ICashierShift>({
  customerDebtAmount: { type: Number, min: 0 }, financingDebtAmount: { type: Number, min: 0 },
  voidedCashMovements: { type: [new Schema({ key: String, payload: String, at: Date, by: String }, { _id: false })], default: [] },
  drawerId: { type: String, index: true }, drawerName: String, openedByName: String, countedBy: String, countedAt: Date,
  closingSnapshot: { type: Schema.Types.Mixed },
  auditLog: { type: [new Schema({ action: String, at: Date, by: String, byName: String, detail: String }, { _id: false })], default: [] },
  shiftCode: { type: String, required: true }, companyCode: { type: String, required: true, index: true }, branchId: { type: String, required: true, index: true }, terminalId: { type: String, trim: true },
  cashierId: { type: String, required: true, index: true }, cashierName: { type: String, required: true }, openingFloat: { type: Number, min: 0, required: true }, openedAt: { type: Date, required: true }, openedBy: { type: String, required: true },
  cashMovements: { type: [CashMovementSchema], default: [] }, grossSales: { type: Number, min: 0, default: 0 }, collectedAmount: { type: Number, min: 0, default: 0 }, newDebtAmount: { type: Number, min: 0, default: 0 }, refundedAmount: { type: Number, min: 0, default: 0 }, netCollectedAmount: { type: Number, default: 0 }, methodTotals: { type: [MethodTotalSchema], default: [] }, expectedCash: { type: Number, min: 0, default: 0 },
  countedCash: { type: Number, min: 0 }, varianceAmount: { type: Number }, varianceReason: { type: String, trim: true }, status: { type: String, enum: ["open", "closed", "reconciled"], required: true, default: "open", index: true }, businessDate: { type: String, required: true, index: true }, closedAt: Date, closedBy: String, approvedBy: String, approvedByName: String, approvedAt: Date,
  workShiftId: String, workShiftCode: String, workShiftName: String, workShiftSource: String, workShiftBusinessDate: String, scheduledStartAt: Date, scheduledEndAt: Date, operationalEndsAt: { type: Date, index: true },
  closingMode: { type: String, enum: ["manual", "midnight"] }, activityVersion: { type: Number, default: 0 }, lastActivityAt: Date,
}, { timestamps: true });
CashierShiftSchema.add({ pausedAt: Date, pausedBy: String, pauseReason: String, terminalHistory: { type: [new Schema({ fromTerminalId: String, toTerminalId: String, changedAt: Date, changedBy: String }, { _id: false })], default: [] } });
CashierShiftSchema.index({ companyCode: 1, branchId: 1, cashierId: 1 }, { unique: true, partialFilterExpression: { status: "open" } });
CashierShiftSchema.index({ companyCode: 1, branchId: 1, terminalId: 1 }, { unique: true, partialFilterExpression: { status: "open", terminalId: { $type: "string" } } });
CashierShiftSchema.index({ companyCode: 1, shiftCode: 1 }, { unique: true });
CashierShiftSchema.index({ companyCode: 1, branchId: 1, drawerId: 1 }, { unique: true, partialFilterExpression: { status: "open", drawerId: { $type: "string" } } });
export const CashierShiftModel = model<ICashierShift>("CashierShift", CashierShiftSchema);
