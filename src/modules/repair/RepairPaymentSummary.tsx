import { useEffect, useState } from "react";
import { repairService, type RepairTicket } from "../../services/repairService";

type Summary = Awaited<ReturnType<typeof repairService.reconcilePayments>>;
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
export default function RepairPaymentSummary({ ticket }: { ticket: RepairTicket }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void repairService.reconcilePayments(ticket._id).then((value) => { if (active) setSummary(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không đối soát được khoản thu."); }); return () => { active = false; }; }, [ticket._id, ticket.paidAmount, ticket.dueAmount]);
  return <section className="mt-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface" aria-label="Đối soát thanh toán sửa chữa">
    <h3 className="text-balance font-semibold">Đối soát thanh toán</h3>
    {error && <p role="alert" className="mt-2 text-error">{error}</p>}
    {!summary && !error && <p role="status" className="mt-2 text-on-surface-variant">Đang đối soát...</p>}
    {summary && <><p className="mt-2 tabular-nums">Đã thu: {money(summary.currentPaid)} · Còn lại: {money(summary.currentDue)}</p><p className="mt-1 text-on-surface-variant">{summary.balanced ? "Sổ thu khớp với phiếu sửa." : "Sổ thu đang lệch với phiếu sửa; cần kiểm tra trước khi thu tiếp."}{summary.baseline > 0 ? ` Bao gồm ${money(summary.baseline)} đã thu trước khi mở sổ chi tiết.` : ""}</p>{!!summary.payments.length && <ol className="mt-2 space-y-1">{summary.payments.map((payment) => <li key={payment._id} className="tabular-nums">{new Date(payment.createdAt).toLocaleString("vi-VN")} · +{money(payment.amount)}</li>)}</ol>}</>}
  </section>;
}
