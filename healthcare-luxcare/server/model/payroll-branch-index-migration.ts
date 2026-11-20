import { AttendancePeriodResultModel } from "./attendance-period-result.model";
import { PayrollOperationJobModel } from "./payroll-operation-job.model";

type MongoIndex = {
  name?: string;
  key: Record<string, number>;
  unique?: boolean;
};

export type PayrollBranchIndexCollection = {
  indexes(): Promise<MongoIndex[]>;
  dropIndex(name: string): Promise<unknown>;
};

const legacyJobIndex = { companyCode: 1, idempotencyKey: 1 };
const legacyAttendanceIndex = { companyCode: 1, periodKey: 1, employeeId: 1 };

async function dropLegacyUniqueIndex(
  collection: PayrollBranchIndexCollection,
  legacyKey: Record<string, number>,
): Promise<boolean> {
  let indexes: MongoIndex[];
  try {
    indexes = await collection.indexes();
  } catch (error: any) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) return false;
    throw error;
  }
  const legacy = indexes.find((index) => index.unique === true
    && JSON.stringify(index.key) === JSON.stringify(legacyKey));
  if (!legacy?.name) return false;
  try {
    await collection.dropIndex(legacy.name);
    return true;
  } catch (error: any) {
    if (error?.codeName === "IndexNotFound" || error?.code === 27) return false;
    throw error;
  }
}

export const dropLegacyPayrollOperationJobIdempotencyIndex = (
  collection: PayrollBranchIndexCollection = PayrollOperationJobModel.collection as unknown as PayrollBranchIndexCollection,
) => dropLegacyUniqueIndex(collection, legacyJobIndex);

export const dropLegacyAttendancePeriodResultUniqueIndex = (
  collection: PayrollBranchIndexCollection = AttendancePeriodResultModel.collection as unknown as PayrollBranchIndexCollection,
) => dropLegacyUniqueIndex(collection, legacyAttendanceIndex);
