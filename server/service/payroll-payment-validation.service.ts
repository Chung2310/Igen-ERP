type Request = { amount: number; lines: Array<{ employeeId: string; amount: number }> };
type SnapshotLine = { employeeId: string; netPay: number; confirmedPaid?: number };

export function validatePayrollPaymentRequest(request: Request, snapshot: SnapshotLine[]) {
  if (!Number.isInteger(request.amount) || request.amount <= 0) throw new Error("Payment amount must be a positive integer");
  const byEmployee = new Map(snapshot.map((line) => [line.employeeId, line]));
  for (const line of request.lines) {
    const source = byEmployee.get(line.employeeId);
    if (!source) throw new Error("Payment employee is not in the payroll snapshot");
    if (!Number.isInteger(line.amount) || line.amount <= 0 || line.amount > source.netPay - (source.confirmedPaid || 0)) throw new Error("Payment amount exceeds remaining payroll balance");
  }
  if (request.lines.reduce((sum, line) => sum + line.amount, 0) !== request.amount) throw new Error("Payment allocation does not match payment amount");
  return request.lines;
}


