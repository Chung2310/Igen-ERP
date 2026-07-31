import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { payrollService } from "../../services/payrollService";

type Payslip = { runId: string; periodKey?: string; employeeId: string; employeeName?: string; netPay: number; paidAmount: number; balance: number };
export default function EmployeePayslips() {
  const [items, setItems] = useState<Payslip[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { void payrollService.getEmployeePayslips().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Không thể tải payslip")).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="p-5 text-sm text-slate-500">Đang tải payslip...</div>;
  if (error) return <div className="p-5 text-sm text-rose-600">{error}</div>;
  return <section className="space-y-3 p-5"><h2 className="text-lg font-bold text-slate-900">Payslip của tôi</h2>{!items.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có payslip được publish.</p>}{items.map((item) => <article key={`${item.runId}-${item.employeeId}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-semibold text-slate-800">Kỳ {item.periodKey}</p><p className="text-sm text-slate-500">Thực nhận: {item.netPay.toLocaleString()} đ</p><p className="text-xs text-slate-400">Đã trả {item.paidAmount.toLocaleString()} đ · Còn lại {item.balance.toLocaleString()} đ</p></div><button title="In phiếu lương" className="rounded-lg border p-2 text-slate-600" onClick={() => window.open(payrollService.printPayslip(item.runId, item.employeeId), "_blank", "noopener,noreferrer")}><Printer size={16} /></button></article>)}</section>;
}