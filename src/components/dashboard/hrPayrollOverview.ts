export type DepartmentPayrollRow = { name: string; total: number; average: number; count: number };

export function summarizeDepartmentPayroll(
  employees: Array<{ uid: string; department?: string; monthlySalary?: number | null }>,
): DepartmentPayrollRow[] {
  const groups = new Map<string, { total: number; count: number }>();
  for (const employee of employees) {
    const amount = Number(employee.monthlySalary ?? 0);
    const name = employee.department?.trim() || "Chưa phân phòng ban";
    const group = groups.get(name) ?? { total: 0, count: 0 };
    group.total += Number.isFinite(amount) ? amount : 0;
    group.count += 1;
    groups.set(name, group);
  }
  return [...groups].map(([name, group]) => ({ name, total: group.total, average: group.total / group.count, count: group.count }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}
