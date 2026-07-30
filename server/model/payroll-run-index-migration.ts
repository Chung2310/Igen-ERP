import { PayrollRunModel } from "./payroll-run.model";

type PayrollRunIndex = {
  name?: string;
  key: Record<string, number>;
  unique?: boolean;
};

export type PayrollRunIndexCollection = {
  indexes(): Promise<PayrollRunIndex[]>;
  dropIndex(name: string): Promise<unknown>;
};

const legacyPayrollRunIndex = { companyCode: 1, periodKey: 1 };

const matchesLegacyIndex = (index: PayrollRunIndex) => index.unique === true
  && JSON.stringify(index.key) === JSON.stringify(legacyPayrollRunIndex);

/** Removes only the legacy unique company/period index, and is safe to rerun. */
export async function dropLegacyPayrollRunPeriodIndex(
  collection: PayrollRunIndexCollection = PayrollRunModel.collection as unknown as PayrollRunIndexCollection,
): Promise<boolean> {
  const legacyIndex = (await collection.indexes()).find(matchesLegacyIndex);
  if (!legacyIndex?.name) return false;

  try {
    await collection.dropIndex(legacyIndex.name);
    return true;
  } catch (error: any) {
    if (error?.codeName === "IndexNotFound" || error?.code === 27) return false;
    throw error;
  }
}
