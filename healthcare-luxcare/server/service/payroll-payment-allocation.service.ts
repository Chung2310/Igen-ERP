export type PayrollPaymentLine = { employeeId: string; netPay: number; confirmedPaid: number };

export function allocatePayrollPayment(lines: PayrollPaymentLine[], requested: number) {
  if (!Number.isInteger(requested) || requested <= 0) throw new Error("Số tiền thanh toán phải là số nguyên dương.");
  const remaining = lines.reduce((sum, line) => sum + Math.max(0, line.netPay - line.confirmedPaid), 0);
  if (requested > remaining) throw new Error("Số tiền thanh toán vượt quá số dư lương còn lại.");
  let amountLeft = requested;
  return lines.flatMap((line) => {
    const available = Math.max(0, line.netPay - line.confirmedPaid);
    const amount = Math.min(available, amountLeft);
    amountLeft -= amount;
    return amount > 0 ? [{ employeeId: line.employeeId, amount }] : [];
  });
}

export function derivePayrollPaymentStatus(netPay: number, confirmedPaid: number): "unpaid" | "partially_paid" | "paid" {
  if (confirmedPaid <= 0) return "unpaid";
  if (confirmedPaid < netPay) return "partially_paid";
  return "paid";
}
