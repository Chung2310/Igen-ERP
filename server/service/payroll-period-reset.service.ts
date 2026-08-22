import type { ClientSession } from "mongoose";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { PayrollAdjustmentModel } from "../model/payroll-adjustment.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollRunScopeReservationModel } from "../model/payroll-run-scope-reservation.model";
import {
  runPayrollAtomicTransaction,
  type PayrollTransactionRunner,
} from "./payroll-transaction.service";
import { PayrollOperationError } from "./payroll-run-operations.service";

export type PayrollPeriodResetScope = {
  companyCode: string;
  branchId: string;
};

type PayrollPeriodResetDependencies = {
  transactionRunner?: PayrollTransactionRunner;
};

const canonicalRunOrder = { createdAt: 1 as const, _id: 1 as const };

const sessionOptions = (session?: ClientSession) => (
  session ? { session } : {}
);

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

const operationalRunFailure = (): never => {
  throw new PayrollOperationError(
    "PAYROLL_OPERATIONAL_RUN",
    "This payroll run is revision-backed; use the run workflow endpoints",
    409,
  );
};

const reservationFailure = () => new PayrollOperationError(
  "PAYROLL_RUN_RESERVATION_CONFLICT",
  "Payroll period reset could not reserve its branch",
  409,
);

export function createPayrollPeriodResetService(
  dependencies: PayrollPeriodResetDependencies = {},
) {
  const transactionRunner = dependencies.transactionRunner ?? runPayrollAtomicTransaction;

  const resetWithinTransaction = (
    scope: PayrollPeriodResetScope,
    periodKey: string,
    actorId: string,
  ) => transactionRunner(async (session) => {
    const periodFilter = { ...scope, periodKey };
    const runFilter = { ...periodFilter, type: "regular" as const };
    await PayrollRunScopeReservationModel.findOneAndUpdate(
      { scopeKey: JSON.stringify([scope.companyCode, scope.branchId]) },
      {
        $setOnInsert: scope,
        $inc: { revision: 1 },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        ...(session ? { session } : {}),
      },
    );
    const operationalRun = await withSession(PayrollRunModel.exists({
      ...periodFilter,
      activeRevisionId: { $exists: true },
    }), session).lean();
    if (operationalRun) operationalRunFailure();

    const runQuery = PayrollRunModel.findOne(runFilter).sort(canonicalRunOrder);
    const run: any = await withSession(runQuery, session).lean();

    if (run?.activeRevisionId) operationalRunFailure();

    const options = sessionOptions(session);
    const deletedRun = run
      ? await PayrollRunModel.deleteOne({ _id: run._id, ...runFilter }, options)
      : { deletedCount: 0 };
    const results = await AttendancePeriodResultModel.deleteMany(periodFilter, options);
    const adjustments = await PayrollAdjustmentModel.deleteMany(periodFilter, options);
    const overrides = await PayrollLineOverrideModel.deleteMany(periodFilter, options);
    const audits = await PayrollAuditModel.deleteMany(periodFilter, options);

    const deleted = {
      run: Number(deletedRun.deletedCount ?? 0),
      results: Number(results.deletedCount ?? 0),
      adjustments: Number(adjustments.deletedCount ?? 0),
      overrides: Number(overrides.deletedCount ?? 0),
      audits: Number(audits.deletedCount ?? 0),
    };

    await PayrollAuditModel.create([{
      ...periodFilter,
      action: "reset",
      actorId,
      metadata: {
        hadRun: Boolean(run),
        results: deleted.results,
        adjustments: deleted.adjustments,
        overrides: deleted.overrides,
        auditsRemoved: deleted.audits,
      },
    }], options);

    return { deleted };
  });

  return async (
    scope: PayrollPeriodResetScope,
    periodKey: string,
    actorId: string,
  ) => {
    const reservationAttempts = 2;
    for (let attempt = 0; attempt < reservationAttempts; attempt += 1) {
      try {
        return await resetWithinTransaction(scope, periodKey, actorId);
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        if (attempt + 1 === reservationAttempts) throw reservationFailure();
      }
    }
    throw reservationFailure();
  };
}

export const resetPayrollPeriod = createPayrollPeriodResetService();
