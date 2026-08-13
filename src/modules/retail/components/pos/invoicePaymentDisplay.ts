type PaymentSnapshot = {
  grandTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: string;
  payments: Array<{ method: string; amount: number; changeAmount?: number }>;
};

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};

export function invoicePaymentRows(snapshot: PaymentSnapshot) {
  const rows = snapshot.payments.map((payment) => ({
    label: paymentLabels[payment.method] || payment.method,
    amount: Number(payment.amount || 0),
  }));
  const paid = snapshot.paidAmount ?? snapshot.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const due = snapshot.dueAmount ?? Math.max(0, Number(snapshot.grandTotal || 0) - paid);
  if (snapshot.paymentStatus === "refunded") rows.push({ label: "Đã hoàn tiền", amount: paid });
  if (due > 0) rows.push({ label: paid > 0 ? "Còn nợ" : "Ghi nợ toàn bộ", amount: due });
  const change = snapshot.payments.reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0);
  if (change > 0) rows.push({ label: "Tiền thừa", amount: change });
  return rows;
}
