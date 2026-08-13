import type { RetailPaymentInput } from "../types";
export type RetailPaymentMode = "full" | "partial" | "debt";
export function buildPaymentSummary(total: number, payments: RetailPaymentInput[], debt: { mode: RetailPaymentMode; customerId?: string; dueDate?: string }) {
  const mode = debt.mode;
  let collected = 0; let change = 0;
  for (const payment of payments) {
    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) throw new Error("Số tiền thanh toán không hợp lệ.");
    collected += payment.amount;
    if (payment.method === "cash") { const tendered = payment.tenderedAmount ?? payment.amount; if (!Number.isSafeInteger(tendered) || tendered < payment.amount) throw new Error("Tiền khách đưa không hợp lệ."); change += tendered - payment.amount; }
    else if (payment.tenderedAmount !== undefined) throw new Error("Chỉ tiền mặt mới có tiền khách đưa.");
  }
  if (collected > total) throw new Error("Tổng thanh toán vượt số tiền phải thu.");
  const due = total - collected;
  if (!debt.customerId?.trim()) {
    throw new Error("Vui lòng chọn khách hàng trước khi thanh toán.");
  }
  if (mode === "full" && due !== 0) throw new Error("Thanh toán đủ cần thu đủ tổng tiền đơn hàng.");
  if (mode === "partial") {
    if (collected <= 0) throw new Error("Thanh toán một phần cần số tiền thực thu lớn hơn 0.");
    if (collected >= total) throw new Error("Thanh toán một phần cần số tiền thực thu nhỏ hơn tổng đơn.");
    if (!debt.customerId || !debt.dueDate) throw new Error("Bán nợ cần chọn khách hàng và hạn thanh toán.");
  }
  if (mode === "debt") {
    if (payments.length > 0) throw new Error("Ghi nợ toàn bộ không nhận tiền thanh toán.");
    if (!debt.customerId || !debt.dueDate) throw new Error("Bán nợ cần chọn khách hàng và hạn thanh toán.");
  }
  return { collected, due, change };
}
