import mongoose, { type ClientSession } from "mongoose";
import type {
  PayrollAttendanceEmployeeSnapshot,
  PayrollIssue,
  PayrollRunType,
} from "../interface/payroll-operations.interface";
import type { PayrollAuditAction } from "../interface/payroll-audit.interface";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { PayrollAttendanceSnapshotModel } from "../model/payroll-attendance-snapshot.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollOperationJobModel } from "../model/payroll-operation-job.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollRunScopeReservationModel } from "../model/payroll-run-scope-reservation.model";

export interface PayrollOperationScope {
  companyCode: string;
  branchId: string;
}

export interface CreatePayrollRunInput {
  periodKey: string;
  startDate: string;
  endDate: string;
  type: PayrollRunType;
  parentRunId?: string;
  supplementalReason?: string;
}

export class PayrollOperationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "PayrollOperationError";
  }
}

const startOfDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999Z`);
const idOf = (value: any) => String(value?._id ?? value?.id ?? "");
const replaySync = (job: any, expectedVersion: number) => ({
  job,
  runVersion: Number(job.result?.runVersion ?? expectedVersion),
});
const payrollRunScopeKey = (scope: PayrollOperationScope) => JSON.stringify([
  scope.companyCode,
  scope.branchId,
]);
const regularOverlapFilter = (scope: PayrollOperationScope, input: CreatePayrollRunInput) => ({
  ...scope,
  type: "regular" as const,
  startDate: { $lte: endOfDay(input.endDate) },
  endDate: { $gte: startOfDay(input.startDate) },
});
const periodOverlapError = () => new PayrollOperationError(
  "PAYROLL_PERIOD_OVERLAP",
  "A regular payroll run overlaps this date range",
  409,
);

async function inTransaction<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (mongoose.connection.readyState !== 1) return operation();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await operation(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function createDocument(model: any, value: Record<string, unknown>, session?: ClientSession) {
  if (!session) return model.create(value);
  const [created] = await model.create([value], { session });
  return created;
}

async function appendAudit(
  scope: PayrollOperationScope,
  periodKey: string,
  action: PayrollAuditAction,
  actorId: string,
  metadata: Record<string, unknown>,
  session?: ClientSession,
) {
  return createDocument(PayrollAuditModel, { ...scope, periodKey, action, actorId, metadata }, session);
}

function assertVersion(run: any, expectedVersion: number) {
  if (run.version !== expectedVersion) {
    throw new PayrollOperationError(
      "PAYROLL_VERSION_CONFLICT",
      "Payroll run version conflict",
      409,
      run.version,
    );
  }
}

function assertDraft(run: any) {
  if (run.status !== "draft") {
    throw new PayrollOperationError("PAYROLL_INVALID_STATE", "Attendance can only be changed for a draft run", 409);
  }
}

async function currentVersionConflict(
  scope: PayrollOperationScope,
  runId: string,
  session?: ClientSession,
) {
  let currentQuery: any = PayrollRunModel.findOne({ _id: runId, ...scope });
  if (session) currentQuery = currentQuery.session(session);
  const current: any = await currentQuery.lean();
  return new PayrollOperationError(
    "PAYROLL_VERSION_CONFLICT",
    "Payroll run version conflict",
    409,
    current?.version,
  );
}

function normalizeAttendance(row: any): PayrollAttendanceEmployeeSnapshot {
  return {
    employeeId: String(row.employeeId),
    ...(row.employeeName ? { employeeName: String(row.employeeName) } : {}),
    standardHours: Number(row.standardHours || 0),
    standardDays: Number(row.standardDays || 0),
    workedMinutes: Number(row.workedMinutes || 0),
    shortageMinutes: Number(row.shortageMinutes || 0),
    paidLeaveMinutesByRate: (row.paidLeaveMinutesByRate || []).map((item: any) => ({
      minutes: Number(item.minutes || 0), payRate: Number(item.payRate || 0),
    })),
    overtime: (row.overtime || []).map((item: any) => ({
      minutes: Number(item.minutes || 0), category: item.category, night: Boolean(item.night),
    })),
    sourceResultId: idOf(row),
    sourceVersion: Number(row.version ?? row.__v ?? 0),
  };
}

function attendanceIssues(runId: string, rows: any[]): PayrollIssue[] {
  if (!rows.length) {
    return [{
      code: "ATTENDANCE_RESULTS_MISSING",
      message: "No attendance results are available for this payroll period",
      runId,
      severity: "blocking",
      remediation: "Generate and approve attendance results, then synchronize again",
    }];
  }
  return rows.flatMap((row): PayrollIssue[] => {
    const issues: PayrollIssue[] = [];
    if (row.status !== "locked") {
      issues.push({
        code: "ATTENDANCE_APPROVAL_PENDING",
        message: "Attendance approval is unresolved",
        runId,
        employeeId: String(row.employeeId),
        field: "status",
        severity: "blocking",
        remediation: "Approve and lock the employee attendance result, then synchronize again",
      });
    }
    if (row.needsRecalculation) {
      issues.push({
        code: "ATTENDANCE_RECALCULATION_REQUIRED",
        message: "Attendance source data changed after the result was prepared",
        runId,
        employeeId: String(row.employeeId),
        severity: "blocking",
        remediation: "Recalculate attendance, approve it, and synchronize again",
      });
    }
    return issues;
  });
}

export async function createRun(scope: PayrollOperationScope, actorId: string, input: CreatePayrollRunInput) {
  if (
    input.type === "supplemental"
    && !input.parentRunId?.trim()
    && !input.supplementalReason?.trim()
  ) {
    throw new PayrollOperationError(
      "PAYROLL_SUPPLEMENTAL_REFERENCE_REQUIRED",
      "Supplemental runs require a parent run or business reason",
      400,
    );
  }
  const createWithinTransaction = () => inTransaction(async (session) => {
    if (input.type === "regular") {
      await PayrollRunScopeReservationModel.findOneAndUpdate(
        { scopeKey: payrollRunScopeKey(scope) },
        {
          $setOnInsert: { ...scope },
          $inc: { revision: 1 },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, ...(session && { session }) },
      );
      let overlapQuery: any = PayrollRunModel.findOne(regularOverlapFilter(scope, input));
      if (session) overlapQuery = overlapQuery.session(session);
      const overlap = await overlapQuery.lean();
      if (overlap) {
        throw periodOverlapError();
      }
    }

    const run = await createDocument(PayrollRunModel, {
      ...scope,
      periodKey: input.periodKey,
      startDate: startOfDay(input.startDate),
      endDate: endOfDay(input.endDate),
      type: input.type,
      ...(input.parentRunId?.trim() ? { parentRunId: input.parentRunId.trim() } : {}),
      ...(input.supplementalReason ? { supplementalReason: input.supplementalReason.trim() } : {}),
      status: "draft",
      version: 0,
      lines: [],
      issues: [],
      totals: { grossPay: 0, deductions: 0, netPay: 0 },
      createdBy: actorId,
    }, session);
    await appendAudit(scope, input.periodKey, "create_run", actorId, {
      operation: "create_run", runId: idOf(run), type: input.type,
    }, session);
    return run;
  });
  if (input.type === "supplemental") return createWithinTransaction();

  const reservationAttempts = 2;
  for (let attempt = 0; attempt < reservationAttempts; attempt += 1) {
    try {
      return await createWithinTransaction();
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      if (attempt + 1 < reservationAttempts) continue;
      const overlap = await PayrollRunModel.findOne(regularOverlapFilter(scope, input)).lean();
      if (overlap) throw periodOverlapError();
      throw new PayrollOperationError(
        "PAYROLL_RUN_RESERVATION_CONFLICT",
        "Payroll run creation is already in progress for this branch",
        409,
      );
    }
  }
  throw new PayrollOperationError("PAYROLL_RUN_RESERVATION_CONFLICT", "Payroll run creation could not reserve its branch", 409);
}

export async function syncAttendance(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const existing = await PayrollOperationJobModel.findOne({
    ...scope, idempotencyKey, operation: "sync-attendance",
  }).lean();
  if (existing) {
    if (existing.runId !== runId || existing.payload?.expectedVersion !== expectedVersion) {
      throw new PayrollOperationError("PAYROLL_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request", 409);
    }
    return replaySync(existing, expectedVersion);
  }

  try {
    return await inTransaction(async (session) => {
    let runQuery: any = PayrollRunModel.findOne({ _id: runId, ...scope });
    if (session) runQuery = runQuery.session(session);
    const run: any = await runQuery.lean();
    if (!run) throw new PayrollOperationError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found", 404);
    assertVersion(run, expectedVersion);
    assertDraft(run);

    const job = await createDocument(PayrollOperationJobModel, {
      ...scope,
      runId,
      idempotencyKey,
      operation: "sync-attendance",
      status: "running",
      payload: { expectedVersion },
    }, session);

    let attendanceQuery: any = AttendancePeriodResultModel.find({ ...scope, periodKey: run.periodKey });
    if (session) attendanceQuery = attendanceQuery.session(session);
    const rows: any[] = await attendanceQuery.lean();
    const employees = rows.map(normalizeAttendance);
    const issues = attendanceIssues(runId, rows);
    const updateOptions = { returnDocument: 'after', runValidators: true, ...(session && { session }) };
    const updated: any = await PayrollRunModel.findOneAndUpdate(
      { _id: runId, ...scope, status: "draft", version: expectedVersion },
      { $set: { issues }, $inc: { version: 1 } },
      updateOptions,
    );
    if (!updated) {
      throw await currentVersionConflict(scope, runId, session);
    }
    const result = {
      employees,
      issues,
      employeeCount: employees.length,
      blockingIssueCount: issues.filter((issue) => issue.severity === "blocking").length,
      runVersion: updated.version,
    };
    const succeeded: any = await PayrollOperationJobModel.findOneAndUpdate(
      { _id: idOf(job), ...scope, runId, operation: "sync-attendance" },
      { $set: { status: "succeeded", result } },
      updateOptions,
    );
    await appendAudit(scope, run.periodKey, "sync_attendance", actorId, {
      operation: "sync_attendance", runId, jobId: idOf(job),
      employeeCount: result.employeeCount, blockingIssueCount: result.blockingIssueCount,
      beforeVersion: expectedVersion, afterVersion: updated.version,
    }, session);
      return { job: succeeded, runVersion: updated.version };
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const winner: any = await PayrollOperationJobModel.findOne({
      ...scope, idempotencyKey, operation: "sync-attendance",
    }).lean();
    if (winner) {
      if (winner.runId !== runId || winner.payload?.expectedVersion !== expectedVersion) {
        throw new PayrollOperationError("PAYROLL_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request", 409);
      }
      return replaySync(winner, expectedVersion);
    }
    throw new PayrollOperationError("PAYROLL_IDEMPOTENCY_CONFLICT", "Idempotency key is already reserved", 409);
  }
}

export async function listIssues(scope: PayrollOperationScope, runId: string): Promise<PayrollIssue[]> {
  const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
  if (!run) throw new PayrollOperationError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found", 404);
  return run.issues || [];
}

export async function lockAttendance(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  expectedVersion: number,
) {
  return inTransaction(async (session) => {
    let runQuery: any = PayrollRunModel.findOne({ _id: runId, ...scope });
    if (session) runQuery = runQuery.session(session);
    const run: any = await runQuery.lean();
    if (!run) throw new PayrollOperationError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found", 404);
    assertVersion(run, expectedVersion);
    assertDraft(run);
    if ((run.issues || []).some((issue: PayrollIssue) => issue.severity === "blocking")) {
      throw new PayrollOperationError("PAYROLL_BLOCKING_ISSUES", "Resolve blocking attendance issues before locking", 409);
    }

    let syncQuery: any = PayrollOperationJobModel.findOne({
      ...scope,
      runId,
      operation: "sync-attendance",
      status: "succeeded",
      "result.runVersion": expectedVersion,
    }).sort({ createdAt: -1, _id: -1 });
    if (session) syncQuery = syncQuery.session(session);
    const syncJob: any = await syncQuery.lean();
    if (!syncJob || !Array.isArray(syncJob.result?.employees)) {
      throw new PayrollOperationError("PAYROLL_ATTENDANCE_NOT_SYNCED", "Synchronize attendance before locking", 409);
    }

    const updateOptions = { returnDocument: 'after', runValidators: true, ...(session && { session }) };
    const updated: any = await PayrollRunModel.findOneAndUpdate(
      { _id: runId, ...scope, status: "draft", version: expectedVersion },
      { $inc: { version: 1 } },
      updateOptions,
    );
    if (!updated) {
      throw await currentVersionConflict(scope, runId, session);
    }
    const lockedAt = new Date().toISOString();
    const snapshot = await createDocument(PayrollAttendanceSnapshotModel, {
      ...scope,
      runId,
      periodKey: run.periodKey,
      employees: syncJob.result.employees,
      lockedAt,
      lockedBy: actorId,
    }, session);
    await appendAudit(scope, run.periodKey, "lock_attendance", actorId, {
      operation: "lock_attendance", runId, snapshotId: idOf(snapshot),
      beforeVersion: expectedVersion, afterVersion: updated.version,
    }, session);
    return { run: updated, snapshot };
  });
}
