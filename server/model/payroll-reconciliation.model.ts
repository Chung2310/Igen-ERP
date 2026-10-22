import { Schema, model } from "mongoose";

// All nested writes are built by the reconciliation service, never copied from a request body.
const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  runId: { type: String, required: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String, default: "" },
  periodKey: { type: String, required: true },
  version: { type: Number, default: 0 },
  snapshot: { type: Schema.Types.Mixed, required: true },
  publications: { type: [Schema.Types.Mixed], default: [] },
  issues: { type: [Schema.Types.Mixed], default: [] },
  confirmedChecksum: String,
  confirmedAt: String,
  confirmations: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, versionKey: false });
schema.index({ companyCode: 1, branchId: 1, runId: 1, employeeId: 1 }, { unique: true });
schema.index({ companyCode: 1, employeeId: 1, periodKey: -1 });
export const PayrollReconciliationModel = model("PayrollReconciliation", schema);
