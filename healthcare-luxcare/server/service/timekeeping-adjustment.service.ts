import { TimekeepingAdjustmentAuditModel } from "../model/timekeeping-adjustment-audit.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";

export interface TimekeepingAdjustmentScope {
  companyCode: string;
  branchId?: string;
}

export class TimekeepingAdjustmentError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const editableFields = ["checkIn", "checkOut", "status", "note"] as const;

function scopedLog(id: string, scope: TimekeepingAdjustmentScope) {
  return { _id: id, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
}

function snapshot(log: any) {
  return Object.fromEntries(editableFields.map((field) => [field, log?.[field] ?? null]));
}

export async function updateTimekeepingWithAudit(input: {
  id: string;
  scope: TimekeepingAdjustmentScope;
  actorId: string;
  reason: string;
  changes: Record<string, unknown>;
}) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) throw new TimekeepingAdjustmentError("Lý do chỉnh sửa phải có ít nhất 3 ký tự.", 400);

  const current = await TimekeepingLogModel.findOne(scopedLog(input.id, input.scope)).lean();
  if (!current) throw new TimekeepingAdjustmentError("Không tìm thấy bản ghi chấm công.", 404);

  const allowedChanges = Object.fromEntries(
    editableFields.filter((field) => Object.hasOwn(input.changes, field)).map((field) => [field, input.changes[field]]),
  );
  const adjustedAt = new Date();
  const updated = await TimekeepingLogModel.findOneAndUpdate(
    scopedLog(input.id, input.scope),
    { $set: { ...allowedChanges, manuallyAdjusted: true, adjustedAt, adjustedBy: input.actorId, adjustmentReason: reason } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw new TimekeepingAdjustmentError("Không tìm thấy bản ghi chấm công.", 404);

  await TimekeepingAdjustmentAuditModel.create({
    companyCode: input.scope.companyCode,
    logId: current._id,
    employeeId: current.uid,
    date: current.date,
    actorId: input.actorId,
    reason,
    before: snapshot(current),
    after: snapshot(updated),
  });
  return updated;
}

export async function getTimekeepingAdjustmentHistory(id: string, scope: TimekeepingAdjustmentScope) {
  const log = await TimekeepingLogModel.findOne(scopedLog(id, scope)).lean();
  if (!log) throw new TimekeepingAdjustmentError("Không tìm thấy bản ghi chấm công.", 404);

  const entries = await TimekeepingAdjustmentAuditModel.find({ companyCode: scope.companyCode, logId: log._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const actorIds = Array.from(new Set(entries.map((entry: any) => String(entry.actorId)).filter(Boolean)));
  const actors = actorIds.length
    ? await UserModel.find({ _id: { $in: actorIds }, companyCode: scope.companyCode }).select("displayName email").lean()
    : [];
  const actorMap = new Map(actors.map((actor: any) => [String(actor._id), actor.displayName || actor.email || String(actor._id)]));
  return entries.map((entry: any) => ({ ...entry, actorName: actorMap.get(String(entry.actorId)) || String(entry.actorId) }));
}
