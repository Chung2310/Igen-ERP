import type { ClientSession } from "mongoose";
import { PayrollReconciliationModel } from "../model/payroll-reconciliation.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { loadAuthoritativePayrollLines } from "./payroll-effective-line.service";
import { runPayrollAtomicTransaction } from "./payroll-transaction.service";
import { applyReconciliationAction, assertReconciliationReady, publishReconciliation, reconciliationChecksum, reconciliationError, type ReconciliationAction } from "./payroll-reconciliation-state";
import type { PayrollReconciliation } from "../../src/shared/payrollReconciliation";
import { PayrollPublicationScheduleModel } from "../model/payroll-publication-schedule.model";
import { duePublicationPeriods } from "./payroll-publication-schedule-state";

type Scope = { companyCode: string; branchId: string };
type Actor = { id: string; name: string; role: "employee" | "staff" };
const querySession = (query: any, session?: ClientSession) => session ? query.session(session) : query;
const options = (session?: ClientSession) => ({ returnDocument: "after" as const, ...(session ? { session } : {}) });
const publicRecord = (record: any): PayrollReconciliation => ({
  runId: record.runId, employeeId: record.employeeId, employeeName: record.employeeName, periodKey: record.periodKey,
  version: record.version, snapshot: record.snapshot, publications: record.publications ?? [], issues: record.issues ?? [],
  confirmedChecksum: record.confirmedChecksum, confirmedAt: record.confirmedAt, confirmations: record.confirmations ?? [],
});
async function findRun(scope: Scope, runId: string, session?: ClientSession) {
  const run: any = await querySession(PayrollRunModel.findOne({ _id: runId, ...scope }), session).lean();
  if (!run) throw reconciliationError("Không tìm thấy kỳ lương.", 404);
  return run;
}
async function claimRun(scope: Scope, run: any, session?: ClientSession) {
  if (run.status !== "draft") throw reconciliationError("Chỉ được đối soát khi kỳ lương còn tạm tính (Nháp).");
  const claimed = await PayrollRunModel.findOneAndUpdate({ _id: run._id, ...scope, status: "draft", version: Number(run.version ?? 0) }, {
    $inc: { version: 1 }, $set: { reconciliationRequired: true },
  }, options(session));
  if (!claimed) throw reconciliationError("Kỳ lương vừa thay đổi. Vui lòng tải lại.");
}
async function audit(scope: Scope, run: any, actorId: string, operation: string, metadata: object, session?: ClientSession) {
  const value = { ...scope, periodKey: run.periodKey, actorId, action: "adjustment" as const, metadata: { operation: `reconciliation_${operation}`, runId: String(run._id), ...metadata } };
  if (session) await PayrollAuditModel.create([value], { session });
  else await PayrollAuditModel.create(value);
}
async function saveRecord(scope: Scope, next: PayrollReconciliation, previous: any, session?: ClientSession) {
  const identity = { ...scope, runId: next.runId, employeeId: next.employeeId };
  const { confirmedChecksum, confirmedAt, ...values } = next;
  const saved = await PayrollReconciliationModel.findOneAndUpdate({ ...identity, version: previous?.version ?? { $exists: false } }, {
    $set: { ...values, ...(confirmedChecksum ? { confirmedChecksum, confirmedAt } : {}) },
    ...(!confirmedChecksum ? { $unset: { confirmedChecksum: "", confirmedAt: "" } } : {}),
    $setOnInsert: scope,
  }, { ...options(session), upsert: !previous });
  if (!saved) throw reconciliationError("Nội dung đối soát vừa thay đổi. Vui lòng tải lại.");
}
export async function publishPayrollReconciliation(scope: Scope, runId: string, actorId: string, expectedVersion: number, scheduled?: { version: number; now: Date }) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw reconciliationError("Phiên bản kỳ lương không hợp lệ.", 400);
  return runPayrollAtomicTransaction(async session => {
    const run = await findRun(scope, runId, session);
    if (scheduled) {
      // Touch the configuration in the same transaction: disabling/changing it must
      // serialize with publication, including when multiple server workers scan.
      const config = await PayrollPublicationScheduleModel.findOneAndUpdate({ ...scope, enabled: true, version: scheduled.version }, {
        $set: { lastAttemptAt: scheduled.now },
      }, options(session));
      if (!config || !duePublicationPeriods(config as any, scheduled.now).includes(run.periodKey)) return { skipped: true, employeeCount: 0 };
      if (run.reconciliationRequired || run.status !== "draft" || run.type === "supplemental") return { skipped: true, employeeCount: 0 };
    }
    if (Number(run.version ?? 0) !== expectedVersion) throw reconciliationError("Kỳ lương vừa thay đổi. Vui lòng tải lại.");
    if (run.needsInputRefresh || run.issues?.some((issue: any) => issue.severity === "blocking")) {
      throw reconciliationError("Kỳ lương cần cập nhật dữ liệu hoặc xử lý lỗi trước khi phát hành.");
    }
    await claimRun(scope, run, session);
    const { effectiveLines } = await loadAuthoritativePayrollLines(scope, run, session);
    if (!effectiveLines.length) throw reconciliationError("Chưa có kết quả lương để phát hành.");
    for (const line of effectiveLines) {
      const employeeId = String(line.employeeId);
      const record: any = await querySession(PayrollReconciliationModel.findOne({ ...scope, runId, employeeId }), session).lean();
      const next = publishReconciliation(record ? publicRecord(record) : undefined, { runId, employeeId, employeeName: line.employeeName ?? "", periodKey: run.periodKey }, line, actorId);
      if (!record || next.version !== record.version) await saveRecord(scope, next, record, session);
    }
    await audit(scope, run, actorId, "publish", { employeeCount: effectiveLines.length, automatic: Boolean(scheduled) }, session);
    return { employeeCount: effectiveLines.length };
  });
}
export async function listPayrollReconciliation(scope: Scope, runId: string) {
  const run = await findRun(scope, runId);
  const records: any[] = await PayrollReconciliationModel.find({ ...scope, runId }).sort({ employeeName: 1, employeeId: 1 }).lean();
  const { effectiveLines } = await loadAuthoritativePayrollLines(scope, run);
  return { runVersion: Number(run.version ?? 0), runStatus: run.status, employeeCount: effectiveLines.length, items: records.map(record => {
    const line = effectiveLines.find(item => String(item.employeeId) === record.employeeId);
    return { ...publicRecord(record), runStatus: run.status, stale: !line || record.snapshot.checksum !== reconciliationChecksum(line) };
  }) };
}
export async function listMyPayrollReconciliation(companyCode: string, employeeId: string) {
  const records: any[] = await PayrollReconciliationModel.find({ companyCode, employeeId }).sort({ periodKey: -1 }).limit(60).lean();
  const items: PayrollReconciliation[] = [];
  for (const record of records) {
    const scope = { companyCode, branchId: record.branchId };
    const run: any = await PayrollRunModel.findOne({ _id: record.runId, ...scope }).lean();
    if (!run) continue;
    const { effectiveLines } = await loadAuthoritativePayrollLines(scope, run);
    const line = effectiveLines.find(item => String(item.employeeId) === employeeId);
    items.push({ ...publicRecord(record), runStatus: run.status, stale: !line || record.snapshot.checksum !== reconciliationChecksum(line) });
  }
  return items;
}
export async function actPayrollReconciliation(scope: Scope, runId: string, employeeId: string, actor: Actor, expectedVersion: number, action: ReconciliationAction) {
  if (actor.role === "employee" && actor.id !== employeeId) throw reconciliationError("Không được truy cập lương của nhân viên khác.", 403);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw reconciliationError("Phiên bản đối soát không hợp lệ.", 400);
  return runPayrollAtomicTransaction(async session => {
    const run = await findRun(scope, runId, session);
    await claimRun(scope, run, session);
    const record: any = await querySession(PayrollReconciliationModel.findOne({ ...scope, runId, employeeId }), session).lean();
    if (!record) throw reconciliationError("Bảng lương tạm tính chưa được phát hành.", 404);
    if (record.version !== expectedVersion) throw reconciliationError("Nội dung đối soát vừa thay đổi. Vui lòng tải lại.");
    if (action.action === "confirm") {
      const { effectiveLines } = await loadAuthoritativePayrollLines(scope, run, session);
      const line = effectiveLines.find(item => String(item.employeeId) === employeeId);
      if (!line || reconciliationChecksum(line) !== record.snapshot.checksum) throw reconciliationError("Kế toán đã sửa lương. Vui lòng chờ phát hành bản mới trước khi xác nhận.");
    }
    const next = applyReconciliationAction(publicRecord(record), action, actor);
    await saveRecord(scope, next, record, session);
    await audit(scope, run, actor.id, action.action, { employeeId, field: action.field, issueId: action.issueId, beforeVersion: record.version, afterVersion: next.version }, session);
    return next;
  });
}
export async function actMyPayrollReconciliation(companyCode: string, employeeId: string, runId: string, name: string, expectedVersion: number, action: ReconciliationAction) {
  const record: any = await PayrollReconciliationModel.findOne({ companyCode, employeeId, runId }).select("branchId").lean();
  if (!record) throw reconciliationError("Không tìm thấy bảng lương tạm tính của bạn.", 404);
  return actPayrollReconciliation({ companyCode, branchId: record.branchId }, runId, employeeId, { id: employeeId, name, role: "employee" }, expectedVersion, action);
}
/** Called at both review and close; run-version CAS serializes this with conversations/edits. */
export async function assertPayrollReconciliationReady(scope: Scope, run: any, session?: ClientSession) {
  if (!run.reconciliationRequired) return;
  const records: any[] = await querySession(PayrollReconciliationModel.find({ ...scope, runId: String(run._id ?? run.id) }), session).lean();
  const { effectiveLines } = await loadAuthoritativePayrollLines(scope, run, session);
  assertReconciliationReady(effectiveLines, records.map(publicRecord));
}
