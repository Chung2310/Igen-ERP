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
export async function dropLegacyPayrollRunPeriodKeyUniqueIndex(
  collection: PayrollRunIndexCollection = PayrollRunModel.collection as unknown as PayrollRunIndexCollection,
): Promise<boolean> {
  let indexes: PayrollRunIndex[];
  try { indexes = await collection.indexes(); } catch (error: any) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) return false;
    throw error;
  }
  const legacyIndex = indexes.find(matchesLegacyIndex);
  if (!legacyIndex?.name) return false;

  try {
    await collection.dropIndex(legacyIndex.name);
    return true;
  } catch (error: any) {
    if (error?.codeName === "IndexNotFound" || error?.code === 27) return false;
    throw error;
  }
}
