import { model, Schema } from "mongoose";

const MonthlyKpiRowSchema = new Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  employeeAvatar: { type: String, default: "" },
  totalTasks: { type: Number, required: true, min: 0 },
  completedTasks: { type: Number, required: true, min: 0 },
  pendingTasks: { type: Number, required: true, min: 0 },
  percent: { type: Number, min: 0, max: 100, default: null },
}, { _id: false });

const KanbanMonthlyKpiSnapshotSchema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, default: "" },
  periodKey: { type: String, required: true, match: /^\d{4}-(?:0[1-9]|1[0-2])$/ },
  timezone: { type: String, required: true, enum: ["Asia/Ho_Chi_Minh"] },
  status: { type: String, required: true, enum: ["closed"] },
  closedAt: { type: Date, required: true },
  rows: { type: [MonthlyKpiRowSchema], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } });

KanbanMonthlyKpiSnapshotSchema.index({ companyCode: 1, branchId: 1, periodKey: 1 }, { unique: true });

export const KanbanMonthlyKpiSnapshotModel = model("KanbanMonthlyKpiSnapshot", KanbanMonthlyKpiSnapshotSchema);
