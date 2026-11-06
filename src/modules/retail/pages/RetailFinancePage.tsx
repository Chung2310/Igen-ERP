import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { useRetailScope } from "../hooks/useRetailScope";
import { useAuth } from "../../../context/AuthContext";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { cn } from "../../student-management/lib/utils";
import { VietnameseDatePicker } from "../../student-management/components/Batches/VietnameseDatePicker";
import { Dropdown } from "../../../components/common/Dropdown";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { RetailEmptyState } from "../components/RetailEmptyState";

type CashEntry = { sourceKey: string; businessDate: string; account: string; direction: string; amount: number; description: string };
type Cashbook = { entries: CashEntry[]; summary: { cashNet: number; bankNet: number; count: number }; shiftsReconciliation: Array<{ shiftId: string; shiftCode: string; businessDate: string; status: string; expectedCash: number; countedCash: number | null; varianceAmount: number | null }>; period?: { digest: string }; balanced?: boolean | null };
type Profit = { summary: { revenue: number; knownCost: number; grossProfit: number | null; operatingExpense: number; commissionExpense: number; netProfit: number | null; missingCostCount: number; belowCostCount: number }; bySku: Array<{ sku: string; productName: string; revenue: number; cost: number; grossProfit: number | null; missingCostCount: number }> };
type RetailPartner = { _id: string; code: string; name: string; roles: string[] };
type Statement = { entries: Array<{ _id: string; businessDate: string; sourceCode: string; sku: string; amount: number; ratePercent: number; rateType?: "amount" | "percent"; rateValue?: number }>; payouts: Array<{ _id: string; businessDate: string; reference: string; amount: number }>; balance: number; earned: number; reversed: number; paid: number };
type CommissionKpi = { _id: string; commission: number; sources: number };
const field = "h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
const button = "h-9 rounded-lg bg-primary px-3.5 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const money = (value: number | null | undefined) => value === null || value === undefined ? "Thiếu dữ liệu" : new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const api = <T,>(path: string, options: Parameters<typeof apiFetch>[1]) => apiFetch<{ data: T }>(`/retail/finance${path}`, options).then((response) => response.data);

export default function RetailFinancePage() {
  const { scope } = useRetailScope();
  const { hasPermission, userProfile } = useAuth();
  const canPolicy = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail-partner-policy:manage");
  const canPay = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail-partner-payout:manage");
  const [view, setView] = useState<"cash" | "profit" | "commission">("cash");
  const [from, setFrom] = useState(today()); const [to, setTo] = useState(today());
  const [cashbook, setCashbook] = useState<Cashbook | null>(null); const [profit, setProfit] = useState<Profit | null>(null);
  const [partners, setPartners] = useState<RetailPartner[]>([]);
  const [commissionKpi, setCommissionKpi] = useState<CommissionKpi[]>([]);
  const [partnerId, setPartnerId] = useState(""); const [statement, setStatement] = useState<Statement | null>(null);
  const [voucher, setVoucher] = useState({ account: "cash", direction: "out", profitCategory: "other", amount: "", reason: "", reference: "" });
  const [payout, setPayout] = useState({ amount: "", reference: "", account: "bank" });
  const [closeOpen, setCloseOpen] = useState(false); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const voucherAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const payoutAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const retryKey = (attempt: typeof voucherAttempt, fingerprint: string) => { if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() }; return attempt.current.key; };
  async function load() {
    if (!scope || !from || !to || from > to) return;
    setLoading(true); setError("");
    try {
      const params = { ...scope, from, to };
      if (view === "cash") setCashbook(await api<Cashbook>("/cashbook/reconcile", { params }));
      if (view === "profit") setProfit(await api<Profit>("/profit", { params }));
      if (view === "commission" && canPolicy) {
        const [partnerResponse, kpiResponse] = await Promise.all([
          apiFetch<{ data: RetailPartner[] }>("/retail/partners", { params: scope }),
          api<CommissionKpi[]>("/commission/kpi", { params }),
        ]);
        setPartners(partnerResponse.data.filter((item) => item.roles.includes("collaborator"))); setCommissionKpi(kpiResponse);
        if (partnerId) setStatement(await api<Statement>(`/commission/partners/${partnerId}/statement`, { params }));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu tài chính."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [scope?.companyCode, scope?.branchId, from, to, view, partnerId]);
  async function run(task: () => Promise<unknown>, success: string) { setBusy(true); setError(""); setMessage(""); try { await task(); voucherAttempt.current = null; payoutAttempt.current = null; setMessage(success); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu thay đổi."); } finally { setBusy(false); } }
  const params = scope ? { ...scope, from, to } : {};
  if (!scope) return <p className="text-sm text-on-surface-variant">Vui lòng chọn chi nhánh.</p>;
  return <div className="space-y-3 text-on-surface">
    <div><h1 className="retail-page-title text-balance text-lg font-semibold">Tài chính bán lẻ</h1></div>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline-variant">
      <nav className="flex gap-2 overflow-x-auto" aria-label="Loại báo cáo">{([ ["cash", "Sổ quỹ"], ["profit", "Lãi lỗ"], ["commission", "Hoa hồng"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} className={cn("min-h-10 shrink-0 border-b-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary", view === key ? "border-primary text-primary" : "border-transparent text-on-surface hover:text-primary")} onClick={() => setView(key)}>{label}</button>)}</nav>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {view === "commission" && canPolicy && <div className="w-full min-w-0 sm:w-56"><Dropdown label="Cộng tác viên bán lẻ" value={partnerId} onChange={setPartnerId} options={[{ value: "", label: "Chọn cộng tác viên bán lẻ" }, ...partners.map((item) => ({ value: item._id, label: `${item.code} · ${item.name}` }))]} variant="form" size="md" className="w-full" searchable /></div>}
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none"><span className="shrink-0 whitespace-nowrap">Từ ngày</span><div className="min-w-36 flex-1 sm:w-40"><VietnameseDatePicker ariaLabel="Từ ngày" value={from} max={to || undefined} onChange={setFrom} variant="filter" /></div></div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none"><span className="shrink-0 whitespace-nowrap">Đến ngày</span><div className="min-w-36 flex-1 sm:w-40"><VietnameseDatePicker ariaLabel="Đến ngày" value={to} min={from || undefined} onChange={setTo} variant="filter" /></div></div>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}{message && <p role="status" className="text-sm text-on-surface">{message}</p>}{loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải dữ liệu...</p>}
    {view === "cash" && cashbook && <section className="space-y-3"><div className="grid gap-2 sm:grid-cols-3"><Metric label="Tiền mặt ròng" value={money(cashbook.summary.cashNet)} /><Metric label="Ngân hàng ròng" value={money(cashbook.summary.bankNet)} /><Metric label="Số phát sinh" value={String(cashbook.summary.count)} /></div>
      <div><HrStatusBadge dot tone={!cashbook.period ? "neutral" : cashbook.balanced ? "success" : "warning"} title={cashbook.period && !cashbook.balanced ? "Dữ liệu nguồn đã thay đổi; cần đối soát." : undefined}>{!cashbook.period ? "Kỳ chưa chốt" : cashbook.balanced ? "Kỳ đã chốt, dữ liệu khớp" : "Kỳ đã chốt, cần đối soát"}</HrStatusBadge></div>
      <form className="grid gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event: FormEvent) => { event.preventDefault(); const fingerprint = JSON.stringify({ ...scope, ...voucher, to }); void run(() => api("/cashbook/vouchers", { method: "POST", params: scope, body: JSON.stringify({ ...voucher, amount: Number(voucher.amount), businessDate: to, idempotencyKey: retryKey(voucherAttempt, fingerprint) }) }), "Đã tạo phiếu thu chi."); }}>
        <Dropdown label="Quỹ" value={voucher.account} onChange={(value) => setVoucher({ ...voucher, account: value })} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank", label: "Ngân hàng" }]} variant="form" size="md" className="w-full" />
        <Dropdown label="Loại phiếu" value={voucher.direction} onChange={(value) => setVoucher({ ...voucher, direction: value, profitCategory: value === "in" ? "other" : voucher.profitCategory })} options={[{ value: "in", label: "Thu" }, { value: "out", label: "Chi" }]} variant="form" size="md" className="w-full" />
        <Dropdown label="Tính vào lãi lỗ" value={voucher.profitCategory} onChange={(value) => setVoucher({ ...voucher, profitCategory: value })} disabled={voucher.direction === "in"} options={[{ value: "other", label: "Không" }, { value: "expense", label: "Chi phí" }]} variant="form" size="md" className="w-full" />
        <label className="text-sm">Số tiền<input className={field} type="number" min="1" step="1" required value={voucher.amount} onChange={(event) => setVoucher({ ...voucher, amount: event.target.value })} /></label>
        <label className="text-sm">Lý do<input className={field} required value={voucher.reason} onChange={(event) => setVoucher({ ...voucher, reason: event.target.value })} /></label>
        <label className="text-sm">Mã tham chiếu<input className={field} value={voucher.reference} onChange={(event) => setVoucher({ ...voucher, reference: event.target.value })} /></label>
        <div className="flex items-end"><button className={button} disabled={busy}>Tạo phiếu</button></div>
      </form>
      <button type="button" className={button} disabled={busy || !!cashbook.period} onClick={() => setCloseOpen(true)}>Chốt kỳ quỹ</button>
      <ConfirmDialog isOpen={closeOpen} title="Chốt kỳ quỹ" description={`Chốt sổ quỹ từ ${from} đến ${to}? Phiếu thu chi của kỳ sẽ không thể thêm.`} confirmLabel="Chốt kỳ" onConfirm={() => { setCloseOpen(false); void run(() => api("/cashbook/close", { method: "POST", params: scope, body: JSON.stringify({ from, to }) }), "Đã chốt kỳ quỹ."); }} onClose={() => setCloseOpen(false)} />
      <DataTable headers={["Ngày", "Nguồn", "Nội dung", "Quỹ", "Thu/chi"]} rows={cashbook.entries.map((item) => [item.businessDate, item.sourceKey, item.description, item.account === "cash" ? "Tiền mặt" : "Ngân hàng", `${item.direction === "in" ? "+" : "−"}${money(item.amount)}`])} empty="Chưa có phát sinh tiền trong khoảng ngày này." />
      <h2 className="text-balance text-lg font-semibold">Đối soát ca tiền mặt</h2><DataTable headers={["Ngày", "Ca", "Trạng thái", "Dự kiến", "Kiểm đếm", "Chênh lệch"]} rows={cashbook.shiftsReconciliation.map((item) => [item.businessDate, item.shiftCode, item.status, money(item.expectedCash), money(item.countedCash), money(item.varianceAmount)])} empty="Chưa có ca bán trong khoảng ngày này." />
    </section>}
    {view === "profit" && profit && <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Doanh thu" value={money(profit.summary.revenue)} /><Metric label="Giá vốn đã biết" value={money(profit.summary.knownCost)} /><Metric label="Lãi gộp" value={money(profit.summary.grossProfit)} /><Metric label="Lãi ròng sau chi phí" value={money(profit.summary.netProfit)} /></div><p className="text-sm text-on-surface-variant">{profit.summary.missingCostCount} dòng thiếu giá vốn · {profit.summary.belowCostCount} dòng bán dưới giá vốn · Chi phí ghi phiếu: <span className="font-medium text-orange-700">{money(profit.summary.operatingExpense)}</span> · Hoa hồng: <span className="font-medium text-violet-700">{money(profit.summary.commissionExpense)}</span></p><DataTable headers={["SKU", "Sản phẩm", "Doanh thu", "Giá vốn", "Lãi gộp"]} rows={profit.bySku.map((item) => [item.sku, item.productName, money(item.revenue), item.missingCostCount ? "Thiếu dữ liệu" : money(item.cost), money(item.grossProfit)])} empty="Chưa có đơn bán trong khoảng ngày này." /></section>}
    {view === "commission" && <section className="space-y-4">{!canPolicy ? <p className="text-sm text-on-surface-variant">Bạn chưa có quyền quản lý chính sách hoa hồng.</p> : <>
      <DataTable headers={["Cộng tác viên bán lẻ", "Số phát sinh", "Hoa hồng ròng"]} rows={commissionKpi.map((item) => [partners.find((partner) => partner._id === item._id)?.name || item._id, String(item.sources), money(item.commission)])} empty="Chưa có phát sinh hoa hồng trong khoảng ngày này." />
      {partnerId && <><p className="text-pretty text-sm text-on-surface-variant">Cấu hình tại Đối tác bán lẻ → Chính sách hoặc Hoa hồng sản phẩm.</p>
        <button className={button} type="button" disabled={busy} onClick={() => void run(() => api(`/commission/partners/${partnerId}/reconcile`, { method: "POST", params: scope }), "Đã đối soát phát sinh hoa hồng.")}>Đối soát phát sinh</button>
        {statement && <><div className="grid gap-3 sm:grid-cols-4"><Metric label="Đã phát sinh" value={money(statement.earned)} /><Metric label="Đã đảo" value={money(statement.reversed)} /><Metric label="Đã chi trả" value={money(statement.paid)} /><Metric label="Số dư hiện tại" value={money(statement.balance)} /></div><DataTable headers={["Ngày", "Chứng từ", "SKU", "Mức hoa hồng", "Hoa hồng"]} rows={statement.entries.map((item) => [item.businessDate, item.sourceCode, item.sku, item.rateType === "amount" ? `${money(item.rateValue)} / máy` : `${item.rateValue ?? item.ratePercent}%`, money(item.amount)])} empty="Chưa có phát sinh hoa hồng." /></>}
        {canPay && <form className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const fingerprint = JSON.stringify({ ...scope, partnerId, ...payout, to }); void run(() => api(`/commission/partners/${partnerId}/payouts`, { method: "POST", params: scope, body: JSON.stringify({ amount: Number(payout.amount), reference: payout.reference, account: payout.account, businessDate: to, idempotencyKey: retryKey(payoutAttempt, fingerprint) }) }), "Đã ghi nhận chi trả hoa hồng."); }}><label className="text-sm">Số tiền chi trả<input className={field} type="number" min="1" required value={payout.amount} onChange={(event) => setPayout({ ...payout, amount: event.target.value })} /></label><Dropdown label="Quỹ chi" value={payout.account} onChange={(value) => setPayout({ ...payout, account: value })} options={[{ value: "bank", label: "Ngân hàng" }, { value: "cash", label: "Tiền mặt" }]} variant="form" size="md" className="w-full" /><label className="text-sm">Mã giao dịch<input className={field} required value={payout.reference} onChange={(event) => setPayout({ ...payout, reference: event.target.value })} /></label><div className="flex items-end"><button className={button} disabled={busy}>Ghi chi trả</button></div></form>}
      </>}
    </>}</section>}
  </div>;
}

const metricTones: Record<string, string> = {
  "Tiền mặt ròng": "blue", "Ngân hàng ròng": "cyan", "Số phát sinh": "purple", "Doanh thu": "blue",
  "Giá vốn đã biết": "orange", "Lãi gộp": "green", "Lãi ròng sau chi phí": "cyan",
  "Đã phát sinh": "blue", "Đã đảo": "rose", "Đã chi trả": "green", "Số dư hiện tại": "purple",
};
function Metric({ label, value }: { label: string; value: string }) { return <div className={cn("retail-stat-card min-w-0 rounded-md p-3", `retail-stat-card--${metricTones[label] || "blue"}`)}><p className="text-sm font-medium text-white/90">{label}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums text-white">{value}</p></div>; }
function DataTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) { return <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">{rows.length ? <table className="w-full min-w-xl text-left text-sm"><thead><tr className="border-b border-outline-variant">{headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-outline-variant last:border-b-0">{row.map((value, cell) => <td key={cell} className={cn("px-4 py-3 tabular-nums", value.includes("₫") && "font-medium", value.includes("₫") && (value.startsWith("−") || value.startsWith("-")) ? "text-rose-700" : value.includes("₫") && value.startsWith("+") ? "text-emerald-700" : value.includes("₫") ? "text-cyan-700" : "")}>{value}</td>)}</tr>)}</tbody></table> : <RetailEmptyState kind={empty.includes("ca bán") ? "batch" : "fee"} className="min-h-40">{empty}</RetailEmptyState>}</div>; }
