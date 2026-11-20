import { Schema, model } from "mongoose";

interface PayrollRunScopeReservation {
  scopeKey: string;
  companyCode: string;
  branchId: string;
  revision: number;
}

const schema = new Schema<PayrollRunScopeReservation>({
  scopeKey: { type: String, required: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  revision: { type: Number, required: true, default: 0 },
}, { timestamps: true });

schema.index({ scopeKey: 1 }, { unique: true });

export const PayrollRunScopeReservationModel = model<PayrollRunScopeReservation>(
  "PayrollRunScopeReservation",
  schema,
);
