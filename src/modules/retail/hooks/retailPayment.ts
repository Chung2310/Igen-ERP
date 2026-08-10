import type { RetailPaymentInput } from "../types";
export function buildPaymentSummary(total: number, payments: RetailPaymentInput[], debt: { customerId?: string; dueDate?: string }) {
  let collected = 0; let change = 0;
  for (const payment of payments) {
    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) throw new Error("Số tiền thanh toán không hợp lệ.");
    collected += payment.amount;
    if (payment.method === "cash") { const tendered = payment.tenderedAmount ?? payment.amount; if (!Number.isSafeInteger(tendered) || tendered < payment.amount) throw new Error("Tiền khách đưa không hợp lệ."); change += tendered - payment.amount; }
    else if (payment.tenderedAmount !== undefined) throw new Error("Chỉ tiền mặt mới có tiền khách đưa.");
  }
  if (collected > total) throw new Error("Tổng thanh toán vượt số tiền phải thu.");
  const due = total - collected;
  if (due > 0 && (!debt.customerId || !debt.dueDate)) throw new Error("Bán nợ cần chọn khách hàng và hạn thanh toán.");
  return { collected, due, change };
}
