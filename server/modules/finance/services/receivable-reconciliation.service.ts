type Row = { companyCode: string; branchId: string; customerId: string; sourceId: string; balance: number };
type Level = "company" | "branch" | "customer" | "order";

const keys: Record<Level, (row: Row) => string> = {
  company: (row) => row.companyCode,
  branch: (row) => `${row.companyCode}|${row.branchId}`,
  customer: (row) => `${row.companyCode}|${row.branchId}|${row.customerId}`,
  order: (row) => `${row.companyCode}|${row.branchId}|${row.sourceId}`,
};

function totals(rows: Row[], key: (row: Row) => string) {
  const result = new Map<string, number>();
  for (const row of rows) result.set(key(row), (result.get(key(row)) || 0) + Number(row.balance));
  return result;
}

export function reconcileReceivableTotals(retail: Row[], finance: Row[]) {
  const mismatches: Array<{ level: Level; key: string; retail: number; finance: number; difference: number }> = [];
  for (const level of Object.keys(keys) as Level[]) {
    const left = totals(retail, keys[level]); const right = totals(finance, keys[level]);
    for (const key of new Set([...left.keys(), ...right.keys()])) {
      const retailAmount = left.get(key) || 0; const financeAmount = right.get(key) || 0;
      if (retailAmount !== financeAmount) mismatches.push({ level, key, retail: retailAmount, finance: financeAmount, difference: financeAmount - retailAmount });
    }
  }
  return { mismatches, mismatchCount: mismatches.length, repaired: 0 };
}
