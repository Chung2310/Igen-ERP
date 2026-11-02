import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { useRetailScope } from "../hooks/useRetailScope";

type Statement = { partner: { code: string; name: string }; entries: Array<{ _id: string; businessDate: string; sourceCode: string; amount: number }>; payouts: Array<{ _id: string; businessDate: string; reference: string; amount: number }>; balance: number };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const field = "min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

export default function RetailPartnerStatement() {
  const { scope } = useRetailScope();
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today());
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!scope || !from || !to || from > to) return;
    let active = true; setLoading(true); setError("");
    void apiFetch<{ data: Statement }>("/retail/finance/commission/me", { params: { ...scope, from, to } }).then((response) => { if (active) setStatement(response.data); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được sao kê."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, from, to]);
  return <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4" aria-label="Sao kê hoa hồng">
    <div><h2 className="text-balance text-lg font-semibold">Sao kê hoa hồng của tôi</h2><p className="text-pretty text-sm text-on-surface-variant">Xem phát sinh, khoản đảo và chi trả từ chứng từ gốc.</p></div>
    <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Từ ngày<input className={field} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="grid gap-1 text-sm">Đến ngày<input className={field} type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải sao kê...</p>}{error && <p role="alert" className="text-sm text-error">{error}</p>}
    {statement && <><p className="text-sm">Số dư hiện tại: <strong className="tabular-nums">{money(statement.balance)}</strong></p><div className="overflow-x-auto"><table className="w-full min-w-xl text-left text-sm"><thead><tr><th scope="col" className="p-2">Ngày</th><th scope="col" className="p-2">Chứng từ</th><th scope="col" className="p-2">Loại</th><th scope="col" className="p-2">Số tiền</th></tr></thead><tbody>{[...statement.entries.map((item) => ({ ...item, label: item.amount < 0 ? "Đảo hoa hồng" : "Hoa hồng" })), ...statement.payouts.map((item) => ({ ...item, sourceCode: item.reference, amount: -item.amount, label: "Chi trả" }))].sort((a, b) => b.businessDate.localeCompare(a.businessDate)).map((item) => <tr key={item._id} className="border-t border-outline-variant"><td className="p-2">{item.businessDate}</td><td className="p-2">{item.sourceCode}</td><td className="p-2">{item.label}</td><td className="p-2 tabular-nums">{money(item.amount)}</td></tr>)}</tbody></table></div>{!statement.entries.length && !statement.payouts.length && <p className="text-sm text-on-surface-variant">Chưa có phát sinh trong khoảng ngày này.</p>}</>}
  </section>;
}
