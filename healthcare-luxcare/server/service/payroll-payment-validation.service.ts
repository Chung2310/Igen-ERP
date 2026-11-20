type Request = { amount: number; lines: Array<{ employeeId: string; amount: number }> };
type SnapshotLine = { employeeId: string; netPay: number; confirmedPaid?: number };

export function validatePayrollPaymentRequest(request: Request, snapshot: SnapshotLine[]) {
  if (!Number.isInteger(request.amount) || request.amount <= 0) throw new Error("Số tiền thanh toán phải là số nguyên dương.");
  const byEmployee = new Map(snapshot.map((line) => [line.employeeId, line]));
  for (const line of request.lines) {
    const source = byEmployee.get(line.employeeId);
    if (!source) throw new Error("Nhân viên thanh toán không có trong bản chụp bảng lương.");
    if (!Number.isInteger(line.amount) || line.amount <= 0 || line.amount > source.netPay - (source.confirmedPaid || 0)) throw new Error("Số tiền thanh toán vượt quá số dư lương còn lại.");
  }
  if (request.lines.reduce((sum, line) => sum + line.amount, 0) !== request.amount) throw new Error("Phân bổ thanh toán không khớp với tổng số tiền.");
  return request.lines;
}
