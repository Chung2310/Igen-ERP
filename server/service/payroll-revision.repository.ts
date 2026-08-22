import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollOperationJobModel } from "../model/payroll-operation-job.model";
import { PayrollRunModel } from "../model/payroll-run.model";

export function createPayrollRevisionRepositories(scope: { companyCode: string; branchId: string }, runId: string) {
  return {
    run: {
      get: async () => PayrollRunModel.findOne({ _id: runId, ...scope }).lean(),
      activateRevision: async (revisionId: string, expectedVersion: number, checksum: string) =>
        PayrollRunModel.findOneAndUpdate(
          { _id: runId, ...scope, version: expectedVersion, status: "draft" },
          { $set: { activeRevisionId: revisionId, activeRevisionChecksum: checksum }, $inc: { version: 1 } },
          { returnDocument: 'after' },
        ).lean(),
    },
    revision: {
      nextRevision: async (runId: string) => {
        const latest = await PayrollCalculationRevisionModel.findOne({ runId, ...scope }).sort({ revision: -1 }).select("revision").lean();
        return Number(latest?.revision ?? 0) + 1;
      },
      create: async (value: Record<string, unknown>) => PayrollCalculationRevisionModel.create({ ...value, ...scope }),
      update: async (revisionId: string, value: Record<string, unknown>) =>
        PayrollCalculationRevisionModel.findOneAndUpdate({ _id: revisionId, ...scope }, { $set: value }, { returnDocument: 'after' }).lean(),
    },
    idempotency: {
      get: async (key: string) => PayrollOperationJobModel.findOne({ ...scope, idempotencyKey: key, operation: "calculate" }).lean(),
      save: async (key: string, result: Record<string, unknown>) => {
        await PayrollOperationJobModel.create({ ...scope, runId, idempotencyKey: key, operation: "calculate", status: "succeeded", result });
      },
    },
  };
}
