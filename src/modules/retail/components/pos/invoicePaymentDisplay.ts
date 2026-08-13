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

export function invoicePaymentSummary(snapshot: PaymentSnapshot) {
  const paid = snapshot.paidAmount ?? snapshot.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const due = snapshot.dueAmount ?? Math.max(0, Number(snapshot.grandTotal || 0) - paid);
  if (due > 0 && paid > 0) return { label: "Thanh toán một phần", paidAmount: paid, dueAmount: due };
  if (due > 0) return { label: "Ghi nợ toàn bộ", dueAmount: due };
  const methods = [...new Set(snapshot.payments.map((payment) => payment.method))];
  if (methods.length > 1) return { label: "Thanh toán hỗn hợp" };
  if (methods.length === 1) return { label: paymentLabels[methods[0]] || methods[0] };
  return { label: snapshot.paymentStatus === "refunded" ? "Đã hoàn tiền" : "Chưa xác định" };
}
