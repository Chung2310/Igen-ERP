import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Save, Target } from "lucide-react";
import type { WorkerScope } from "../../types";
import { laborPartnersApi } from "../api/laborPartners.api";
import type { LaborPartnerKpiRow } from "../types";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthAnchor = (value: string) => `${value}-01`;
const moneyless = (value: number | null) => value == null ? "—" : `${value}%`;

const statusLabel: Record<LaborPartnerKpiRow["status"], string> = {
  not_set: "Chưa đặt chỉ tiêu",
  achieved: "Đạt KPI",
  incomplete: "Chưa đạt",
};

export function LaborPartnerKpiPanel({ scope, canManage, onOpenSettlements }: { scope: WorkerScope; canManage: boolean; onOpenSettlements?: () => void }) {
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<LaborPartnerKpiRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await laborPartnersApi.listKpi(scope, monthAnchor(month));
      setItems(response.items);
      setDrafts(Object.fromEntries(response.items.map((item) => [item.partnerId, String(item.targetReferrals || "")] )));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể tải KPI giới thiệu.");
    } finally { setLoading(false); }
  }, [month, scope.companyCode, scope.branchId]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    target: items.reduce((total, item) => total + item.targetReferrals, 0),
    actual: items.reduce((total, item) => total + item.actualReferrals, 0),
    achieved: items.filter((item) => item.status === "achieved").length,
  }), [items]);

  const save = async (item: LaborPartnerKpiRow) => {
    const targetReferrals = Number(drafts[item.partnerId] || 0);
    if (!Number.isInteger(targetReferrals) || targetReferrals < 0) {
      setMessage("Chỉ tiêu phải là số nguyên không âm.");
      return;
    }
    setSavingId(item.partnerId);
    setMessage("");
    try {
      await laborPartnersApi.saveKpi(scope, item.partnerId, { periodAnchor: monthAnchor(month), targetReferrals });
      await load();
      setMessage(`Đã lưu chỉ tiêu cho ${item.partner.name}.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể lưu chỉ tiêu KPI.");
    } finally { setSavingId(null); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-black text-slate-800"><Target className="h-5 w-5 text-cyan-600" /> KPI giới thiệu</h2><p className="mt-1 text-xs leading-5 text-slate-500">Đặt chỉ tiêu số lao động cần giới thiệu theo từng tháng và theo dõi kết quả thực tế.</p><p className="mt-1 text-xs font-medium text-amber-700">Lưu ở đây chỉ là chỉ tiêu KPI, không phải giờ làm hoặc số tháng tính hoa hồng.</p></div>
      <div className="flex items-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Tháng theo dõi<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Làm mới"><RefreshCw className="h-4 w-4" /></button>{onOpenSettlements && <button type="button" onClick={onOpenSettlements} className="inline-flex h-9 items-center gap-1 rounded-lg border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50">Nhập giờ/tháng <ArrowRight className="h-3.5 w-3.5" /></button>}</div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tổng chỉ tiêu</p><p className="mt-1 text-lg font-black text-slate-800">{summary.target} người</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs text-cyan-700">Đã giới thiệu</p><p className="mt-1 text-lg font-black text-cyan-800">{summary.actual} người</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Đối tác đạt KPI</p><p className="mt-1 text-lg font-black text-emerald-800">{summary.achieved}</p></div></div>
    {message && <p role="status" className="mt-3 text-sm font-medium text-cyan-700">{message}</p>}
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="p-2">Đối tác</th><th className="p-2">Chỉ tiêu/tháng</th><th className="p-2 text-center">Đã giới thiệu</th><th className="p-2 text-center">Hoàn thành</th><th className="p-2 text-center">Còn thiếu</th><th className="p-2">Trạng thái</th><th className="p-2" /></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Đang tải KPI...</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chưa có đối tác để theo dõi KPI.</td></tr> : items.map((item) => <tr key={item.partnerId} className="border-b border-slate-100"><td className="p-2"><p className="font-bold text-slate-800">{item.partner.name}</p><p className="text-xs text-slate-400">{item.partner.code}</p></td><td className="p-2">{canManage ? <input type="number" min="0" step="1" value={drafts[item.partnerId] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.partnerId]: event.target.value }))} className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-sm" placeholder="0" /> : <span className="font-bold">{item.targetReferrals}</span>}</td><td className="p-2 text-center font-bold text-cyan-700">{item.actualReferrals}</td><td className="p-2 text-center font-bold">{moneyless(item.completionRate)}</td><td className="p-2 text-center text-slate-600">{item.remainingReferrals == null ? "—" : item.remainingReferrals}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.status === "achieved" ? "bg-emerald-50 text-emerald-700" : item.status === "incomplete" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{statusLabel[item.status]}</span></td><td className="p-2 text-right">{canManage && <button type="button" disabled={savingId === item.partnerId} onClick={() => void save(item)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Lưu</button>}</td></tr>)}</tbody></table></div>
  </section>;
}
