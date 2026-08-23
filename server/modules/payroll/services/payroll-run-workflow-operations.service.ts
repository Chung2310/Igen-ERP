import { PayrollAuditModel } from "../models/payroll-audit.model";
import { PayrollCalculationRevisionModel } from "../models/payroll-calculation-revision.model";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollPaymentModel } from "../models/payroll-payment.model";
import type { ClientSession } from "mongoose";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { transitionPayrollRun, type PayrollWorkflowAction } from "./payroll-run-workflow.service";
import {
  createEffectivePayrollSnapshot,
  verifyEffectivePayrollSnapshot,
} from "./payroll-effective-line.service";
import {
  runPayrollAtomicTransaction,
  type PayrollTransactionRunner,
} from "./payroll-transaction.service";

type PayrollRunWorkflowOperationDependencies = {
  transactionRunner?: PayrollTransactionRunner;
};

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

const writeOptions = (session?: ClientSession) => (
  session ? { returnDocument: 'after' as const, session } : { returnDocument: 'after' as const }
);

async function createAudit(document: any, session?: ClientSession) {
  if (!session) return PayrollAuditModel.create(document);
  const [created] = await PayrollAuditModel.create([document], { session });
  return created;
}

export function createPayrollRunWorkflowOperations(
  dependencies: PayrollRunWorkflowOperationDependencies = {},
) {
  const transactionRunner = dependencies.transactionRunner ?? runPayrollAtomicTransaction;

  return async (
    scope: PayrollOperationScope,
    runId: string,
    actorId: string,
    action: PayrollWorkflowAction,
    options: { expectedVersion: number; reason?: string; correlationId?: string },
  ) => transactionRunner(async (session) => {
    let periodKey = "";
    const result: any = await transitionPayrollRun({
      action,
      actorId,
      expectedVersion: options.expectedVersion,
      reason: options.reason,
      correlationId: options.correlationId,
      run: {
        get: async () => {
          const run: any = await withSession(
            PayrollRunModel.findOne({ _id: runId, ...scope }),
            session,
          ).lean();
          periodKey = run?.periodKey ?? "";
          return run;
        },
        apply: async (expectedVersion, from, to, fields) => {
          const unset = Object.entries(fields).filter(([, value]) => value === null).map(([key]) => key);
          const set = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
          return PayrollRunModel.findOneAndUpdate(
            { _id: runId, ...scope, version: expectedVersion, status: from },
            {
              $set: { ...set, status: to },
              $inc: { version: 1 },
              ...(unset.length ? { $unset: Object.fromEntries(unset.map((key) => [key, ""])) } : {}),
            },
            writeOptions(session),
          ).lean();
        },
      },
      revision: {
        getActive: async (revisionId: string) => withSession(
          PayrollCalculationRevisionModel.findOne({ _id: revisionId, ...scope }),
          session,
        ).lean(),
      },
      effective: {
        pin: async (run) => createEffectivePayrollSnapshot(scope, run, session),
        verify: async (run) => verifyEffectivePayrollSnapshot(scope, run, session),
      },
      hasConfirmedPayments: async () => Boolean(await withSession(
        PayrollPaymentModel.exists({
          ...scope,
          runId,
          status: "confirmed",
        }),
        session,
      )),
      audit: async (entry) => createAudit({ ...scope, periodKey, actorId, ...entry }, session),
    });

    if (result?.code) {
      throw new PayrollOperationError(result.code, result.message, result.status, result.currentVersion);
    }
    return result.run;
  });
}

export const runPayrollWorkflowAction = createPayrollRunWorkflowOperations();
