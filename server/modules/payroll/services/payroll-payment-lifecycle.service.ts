export type PayrollPaymentStatus = "draft" | "confirmed" | "cancelled" | "reversed";

export function transitionPayrollPayment(payment: { status: PayrollPaymentStatus }, next: PayrollPaymentStatus) {
  const allowed: Record<PayrollPaymentStatus, PayrollPaymentStatus[]> = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["reversed"],
    cancelled: [],
    reversed: [],
  };
  if (!allowed[payment.status].includes(next)) throw new Error("Invalid payment transition");
  return { status: next };
}
