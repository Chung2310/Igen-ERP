type Employee = { _id: unknown; displayName?: string; email: string };

export function summarizeEmployeeContracts(employees: Employee[], activeEmployeeIds: string[], renewedEmployeeIds: string[]) {
  const active = new Set(activeEmployeeIds.map(String));
  const renewed = new Set(renewedEmployeeIds.map(String));
  const withoutContract = employees.filter(employee => !active.has(String(employee._id)));
  return {
    activeContractEmployeeCount: employees.length - withoutContract.length,
    withoutContractCount: withoutContract.length,
    withoutContractEmployees: withoutContract.map(employee => ({ id: String(employee._id), name: employee.displayName || employee.email })),
    renewedEmployeeCount: employees.filter(employee => renewed.has(String(employee._id))).length,
  };
}
