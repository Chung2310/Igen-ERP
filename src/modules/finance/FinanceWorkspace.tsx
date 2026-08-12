import { useEffect, useMemo, useState } from "react";
import { BellRing, ChartNoAxesColumnIncreasing, Landmark } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { financeReceivablesApi, type FinanceReceivable } from "./api/financeReceivables.api";
import { financeRemindersApi, type ReminderRun } from "./api/financeReminders.api";

type FinanceSubTab = "CÔNG NỢ" | "TUỔI NỢ" | "NHẮC NỢ";
export const FINANCE_SUB_TABS = [
  { slug: "cong-no", value: "CÔNG NỢ" as const, label: "Công nợ", icon: Landmark },
  { slug: "tuoi-no", value: "TUỔI NỢ" as const, label: "Tuổi nợ", icon: ChartNoAxesColumnIncreasing },
  { slug: "nhac-no", value: "NHẮC NỢ" as const, label: "Nhắc nợ", icon: BellRing },
] as const;

export function getAllowedFinanceTabSlugs(permissions: readonly string[] = []) {
  if (permissions.includes("*")) return FINANCE_SUB_TABS.map((tab) => tab.slug);
  const allowed: Array<(typeof FINANCE_SUB_TABS)[number]["slug"]> = [];
  if (permissions.some((item) => ["receivable:read", "receivable:collect", "receivable:adjust"].includes(item))) allowed.push("cong-no");
  if (permissions.includes("receivable:read")) allowed.push("tuoi-no");
  if (permissions.some((item) => ["receivable:read", "receivable:adjust"].includes(item))) allowed.push("nhac-no");
  return allowed;
}

export function resolveFinanceSubTab(search: string, allowed: readonly string[]): FinanceSubTab | undefined {
  const slug = new URLSearchParams(search).get("sub");
  const match = FINANCE_SUB_TABS.find((tab) => tab.slug === slug && allowed.includes(tab.slug));
  return match?.value || FINANCE_SUB_TABS.find((tab) => allowed.includes(tab.slug))?.value;
}

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function ReceivablesPanel() {
  const [items, setItems] = useState<FinanceReceivable[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { financeReceivablesApi.list().then((result) => setItems(result.items)).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được công nợ.")); }, []);
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Danh sách công nợ</h2><p className="text-sm text-slate-500">Theo dõi số dư và hạn thanh toán theo khách hàng.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Mã</th><th className="px-5 py-3">Khách hàng</th><th className="px-5 py-3">Hạn trả</th><th className="px-5 py-3 text-right">Còn nợ</th><th className="px-5 py-3">Trạng thái</th></tr></thead><tbody>{items.map((item) => <tr key={item._id} className="border-t border-slate-100"><td className="px-5 py-3 font-semibold">{item.receivableCode}</td><td className="px-5 py-3">{item.customerName}</td><td className="px-5 py-3">{new Date(item.dueDate).toLocaleDateString("vi-VN")}</td><td className="px-5 py-3 text-right font-semibold">{money.format(item.balance)}</td><td className="px-5 py-3">{item.status}</td></tr>)}</tbody></table>{!items.length && <p className="p-6 text-center text-sm text-slate-500">Chưa có khoản công nợ.</p>}</div></div>;
}

function AgingPanel() {
  const [buckets, setBuckets] = useState<Record<string, { count: number; balance: number }>>({});
  const [error, setError] = useState("");
  useEffect(() => { financeReceivablesApi.aging().then(setBuckets).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được tuổi nợ.")); }, []);
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  const labels: Record<string, string> = { "0-30": "0–30 ngày", "31-60": "31–60 ngày", "61-90": "61–90 ngày", over90: "Trên 90 ngày" };
  return <div><div className="mb-4"><h2 className="text-lg font-bold text-slate-900">Phân tích tuổi nợ</h2><p className="text-sm text-slate-500">Số dư quá hạn được chia theo thời gian chậm thanh toán.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.keys(labels).map((key) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-500">{labels[key]}</p><p className="mt-2 text-2xl font-bold text-slate-900">{money.format(buckets[key]?.balance || 0)}</p><p className="mt-1 text-sm text-slate-500">{buckets[key]?.count || 0} khoản</p></div>)}</div></div>;
}

function RemindersPanel({ canRun }: { canRun: boolean }) {
  const [runs, setRuns] = useState<ReminderRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => financeRemindersApi.listRuns().then(setRuns).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được lịch sử nhắc nợ."));
  useEffect(() => { void load(); }, []);
  const runNow = async () => { setBusy(true); setError(""); try { await financeRemindersApi.runNow(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể chạy nhắc nợ."); } finally { setBusy(false); } };
  return <div className="rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold text-slate-900">Lịch sử nhắc nợ</h2><p className="text-sm text-slate-500">Theo dõi các lượt quét tự động và thủ công.</p></div>{canRun && <button type="button" disabled={busy} onClick={runNow} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang chạy..." : "Chạy nhắc nợ"}</button>}</div>{error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="divide-y divide-slate-100">{runs.map((run) => <div key={run._id} className="grid grid-cols-2 gap-3 px-5 py-4 text-sm sm:grid-cols-5"><span className="font-semibold">{run.businessDate}</span><span>{run.trigger === "manual" ? "Thủ công" : "Tự động"}</span><span>{run.status}</span><span>Đủ điều kiện: {run.eligible}</span><span>Đã xếp hàng: {run.queued}</span></div>)}{!runs.length && !error && <p className="p-6 text-center text-sm text-slate-500">Chưa có lượt nhắc nợ.</p>}</div></div>;
}

export default function FinanceWorkspace() {
  const { userProfile } = useAuth();
  const permissions = userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || [];
  const allowedSlugs = useMemo(() => getAllowedFinanceTabSlugs(permissions), [permissions]);
  const tabs = useMemo(() => FINANCE_SUB_TABS.filter((tab) => allowedSlugs.includes(tab.slug)), [allowedSlugs]);
  const fallback = resolveFinanceSubTab(window.location.search, allowedSlugs) || "CÔNG NỢ";
  const [activeTab, setActiveTab] = useSubTabRouter<FinanceSubTab>(tabs as any, fallback);
  if (!tabs.length) return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng tài chính.</div>;
  return <div className="flex h-full min-h-0 flex-col bg-slate-50"><div className="flex gap-1 border-b border-slate-200 bg-white px-4 pt-3">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.slug} type="button" onClick={() => setActiveTab(tab.value)} className={`flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold ${activeTab === tab.value ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-cyan-50"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{activeTab === "CÔNG NỢ" && <ReceivablesPanel />}{activeTab === "TUỔI NỢ" && <AgingPanel />}{activeTab === "NHẮC NỢ" && <RemindersPanel canRun={permissions.includes("*") || permissions.includes("receivable:adjust")} />}</div></div>;
}
