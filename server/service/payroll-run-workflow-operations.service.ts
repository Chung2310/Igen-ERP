import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { transitionPayrollRun, type PayrollWorkflowAction } from "./payroll-run-workflow.service";

export async function runPayrollWorkflowAction(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  action: PayrollWorkflowAction,
  options: { expectedVersion: number; reason?: string; correlationId?: string },
) {
  let periodKey = "";
  const result: any = await transitionPayrollRun({
    action,
    actorId,
    expectedVersion: options.expectedVersion,
    reason: options.reason,
    correlationId: options.correlationId,
    run: {
      get: async () => {
        const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
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
          { new: true },
        ).lean();
      },
    },
    revision: {
      getActive: async (revisionId: string) => PayrollCalculationRevisionModel.findOne({ _id: revisionId, ...scope }).lean(),
    },
    audit: async (entry) => PayrollAuditModel.create({ ...scope, periodKey, actorId, ...entry }),
  });

  if (result?.code) {
    throw new PayrollOperationError(result.code, result.message, result.status, result.currentVersion);
  }
  return result.run;
}
