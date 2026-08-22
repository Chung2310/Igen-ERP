import type { ClientSession } from "mongoose";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import {
  createEffectivePayrollSnapshot,
  verifyEffectivePayrollSnapshot,
} from "./payroll-effective-line.service";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import {
  runPayrollAtomicTransaction,
  type PayrollTransactionRunner,
} from "./payroll-transaction.service";

type RepairDependencies = {
  transactionRunner: PayrollTransactionRunner;
  getRun: (scope: PayrollOperationScope, runId: string, session?: ClientSession) => Promise<any>;
  createSnapshot: (scope: PayrollOperationScope, run: any, session?: ClientSession) => Promise<any>;
  updateRun: (
    scope: PayrollOperationScope,
    runId: string,
    expectedVersion: number,
    snapshot: any,
    session?: ClientSession,
  ) => Promise<any>;
  verifyRun: (scope: PayrollOperationScope, run: any, session?: ClientSession) => Promise<boolean>;
  createAudit: (entry: any, session?: ClientSession) => Promise<unknown>;
  log: (message: string, context: Record<string, unknown>) => void;
};

const repairError = (code: string, message: string) => (
  new PayrollOperationError(code, message, 409)
);

export function createPayrollEffectiveSnapshotRepairer(dependencies: RepairDependencies) {
  return async (
    scope: PayrollOperationScope,
    runId: string,
    actorId: string,
    expectedVersion: number,
    correlationId?: string,
  ) => dependencies.transactionRunner(async (session) => {
    const current = await dependencies.getRun(scope, runId, session);
    if (!current || current.status !== "review") {
      dependencies.log("[Payroll] Effective snapshot repair refused", {
        stage: "effective-repair-refused",
        runId,
        status: current?.status,
        expectedVersion,
      });
      throw repairError(
        "PAYROLL_EFFECTIVE_REPAIR_REFUSED",
        "Only a review-stage payroll snapshot can be repaired automatically",
      );
    }
    if (Number(current.version ?? 0) !== expectedVersion) {
      throw repairError("PAYROLL_VERSION_CONFLICT", "Payroll run changed before snapshot repair");
    }

    const replacement = await dependencies.createSnapshot(scope, current, session);
    const updated = await dependencies.updateRun(
      scope,
      runId,
      expectedVersion,
      replacement,
      session,
    );
    if (!updated) {
      const winner = await dependencies.getRun(scope, runId, session);
      if (winner && await dependencies.verifyRun(scope, winner, session)) {
        dependencies.log("[Payroll] Effective snapshot repair conflict", {
          stage: "effective-repair-conflict",
          runId,
          periodKey: winner.periodKey,
          expectedVersion,
          winningVersion: winner.version,
        });
        return winner;
      }
      throw repairError("PAYROLL_VERSION_CONFLICT", "Payroll run changed during snapshot repair");
    }
    if (!await dependencies.verifyRun(scope, updated, session)) {
      throw repairError(
        "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
        "Repaired effective payroll snapshot is still invalid",
      );
    }

    await dependencies.createAudit({
      ...scope,
      periodKey: current.periodKey,
      action: "effective_snapshot_repaired",
      actorId,
      metadata: {
        runId,
        previousChecksum: current.effectiveSnapshot?.checksum,
        replacementChecksum: replacement.checksum,
        sourceRevisionChecksum: replacement.sourceRevisionChecksum,
        previousVersion: expectedVersion,
        replacementVersion: Number(updated.version ?? expectedVersion + 1),
        ...(correlationId ? { correlationId } : {}),
      },
    }, session);
    dependencies.log("[Payroll] Effective snapshot repaired", {
      stage: "effective-repair-success",
      runId,
      periodKey: current.periodKey,
      previousVersion: expectedVersion,
      replacementVersion: updated.version,
      previousChecksum: current.effectiveSnapshot?.checksum,
      replacementChecksum: replacement.checksum,
    });
    return updated;
  });
}

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

export const repairReviewEffectivePayrollSnapshot = createPayrollEffectiveSnapshotRepairer({
  transactionRunner: runPayrollAtomicTransaction,
  getRun: async (scope, runId, session) => withSession(
    PayrollRunModel.findOne({ _id: runId, ...scope }),
    session,
  ).lean(),
  createSnapshot: createEffectivePayrollSnapshot,
  updateRun: async (scope, runId, expectedVersion, snapshot, session) => PayrollRunModel.findOneAndUpdate(
    { _id: runId, ...scope, status: "review", version: expectedVersion },
    { $set: { effectiveSnapshot: snapshot }, $inc: { version: 1 } },
    { returnDocument: 'after', ...(session ? { session } : {}) },
  ).lean(),
  verifyRun: verifyEffectivePayrollSnapshot,
  createAudit: async (entry, session) => {
    if (!session) return PayrollAuditModel.create(entry);
    const [created] = await PayrollAuditModel.create([entry], { session });
    return created;
  },
  log: (message, context) => console.error(message, context),
});
