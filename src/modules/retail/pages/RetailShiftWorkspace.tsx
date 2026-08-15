import React from "react";
import { retailShiftsApi } from "../api/retailShifts.api";
import CurrencyInput from "../components/pos/CurrencyInput";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailShift } from "../types";
import { ShiftScheduleNotice } from "../components/ShiftScheduleNotice";

const money = (value = 0) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const statusLabel = (value: RetailShift["status"]) => ({ open: "Đang mở", closed: "Đã đóng", reconciled: "Đã đối soát trước đây" })[value];

export default function RetailShiftWorkspace() {
  const { scope } = useRetailScope();
  const [shift, setShift] = React.useState<RetailShift | null>(null);
  const [closedShift, setClosedShift] = React.useState<RetailShift | null>(null);
  const [history, setHistory] = React.useState<RetailShift[]>([]);
  const [total, setTotal] = React.useState(0);
  const [filters, setFilters] = React.useState({ businessDate: "", cashierId: "", status: "", page: 1 });
  const [openingFloat, setOpeningFloat] = React.useState(0);
  const [terminalId, setTerminalId] = React.useState("");
  const [countedCash, setCountedCash] = React.useState(0);
  const [varianceReason, setVarianceReason] = React.useState("");
  const [error, setError] = React.useState<unknown>(null);
  const [reasonError, setReasonError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<"open" | "close" | null>(null);
  const reasonRef = React.useRef<HTMLInputElement>(null);
  const showError = React.useCallback((cause: unknown) => setError(cause), []);
  const refreshHistory = React.useCallback(async () => {
    if (!scope) return;
    try {
      const result = await retailShiftsApi.list(scope, { ...filters, businessDate: filters.businessDate || undefined, cashierId: filters.cashierId || undefined, status: filters.status || undefined, limit: 20 });
      setHistory(result.items); setTotal(result.total);
    } catch (cause) { showError(cause); }
  }, [scope?.companyCode, scope?.branchId, filters, showError]);
  React.useEffect(() => { if (scope) void retailShiftsApi.current(scope).then(setShift).catch(showError); }, [scope?.companyCode, scope?.branchId, showError]);
  React.useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  if (!scope) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">Vui lòng chọn chi nhánh.</div>;

  const open = async () => { setSubmitting("open"); try { const result = await retailShiftsApi.open(scope, { openingFloat, terminalId: terminalId.trim() || undefined }); setShift(result); setError(null); void refreshHistory(); } catch (cause) { showError(cause); } finally { setSubmitting(null); } };
  const close = async () => { if (!shift) return; setSubmitting("close"); setReasonError(false); try { const result = await retailShiftsApi.close(scope, shift._id, { countedCash, varianceReason: varianceReason.trim() || undefined }); setClosedShift(result); setShift(null); setError(null); void refreshHistory(); } catch (cause) { showError(cause); if (cause instanceof Error && cause.message.toLocaleLowerCase("vi").includes("lý do")) { setReasonError(true); requestAnimationFrame(() => reasonRef.current?.focus()); } } finally { setSubmitting(null); } };
  const expired = Boolean(shift?.operationalEndsAt && new Date(shift.operationalEndsAt).getTime() < Date.now());

  return <section className="mx-auto max-w-5xl space-y-5"><header><h1 className="text-xl font-bold">Ca bán hàng</h1><p className="text-sm text-slate-500">Mở ca nhanh, kiểm đếm mù và lưu kết quả để rà soát.</p></header><ShiftScheduleNotice error={error} />{closedShift ? <ClosingResult shift={closedShift} onNew={() => { setClosedShift(null); setOpeningFloat(0); setTerminalId(""); setCountedCash(0); setVarianceReason(""); }} /> : !shift ? <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Mở ca mới</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><CurrencyInput label="Tiền đầu ca" value={openingFloat} onChange={setOpeningFloat} /><Field label="Mã quầy (không bắt buộc)" value={terminalId} onChange={setTerminalId} /></div><button disabled={submitting === "open" || openingFloat < 0} className="mt-4 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white disabled:opacity-50" onClick={() => void open()}>{submitting === "open" ? "Đang mở ca…" : "Mở ca"}</button></div> : <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><div className="flex justify-between items-start"><div><h2 className="font-bold">{shift.shiftCode}</h2><p className="text-sm text-slate-500">{shift.businessDate} · {shift.cashierName}</p></div><Status value={shift.status} /></div>{expired && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Ca đã hết thời gian hoạt động</p>}</div><div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Đóng ca — kiểm đếm mù</h3><p className="mt-1 text-sm text-slate-500">Số kỳ vọng chỉ hiện sau khi gửi kiểm đếm.</p><div className="mt-4"><CurrencyInput label="Tiền thực đếm" value={countedCash} onChange={setCountedCash} /></div><Field ref={reasonRef} label="Lý do chênh lệch (nếu có)" value={varianceReason} onChange={setVarianceReason} invalid={reasonError} /><button disabled={submitting === "close"} className="mt-3 rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white disabled:opacity-50" onClick={() => void close()}>{submitting === "close" ? "Đang đóng ca…" : "Gửi kiểm đếm và đóng ca"}</button></div></div>}<History items={history} total={total} filters={filters} onFilters={setFilters} /></section>;
}

function ClosingResult({ shift, onNew }: { shift: RetailShift; onNew: () => void }) { const cash = shift.methodTotals?.find((item) => item.method === "cash"); const rows = [["Quỹ đầu ca", shift.openingFloat], ["Tiền mặt đã thu", cash?.collectedAmount || 0], ["Tiền mặt hoàn lại", cash?.refundedAmount || 0], ["Tiền kỳ vọng", shift.expectedCash || 0], ["Tiền thực đếm", shift.countedCash || 0], ["Chênh lệch", shift.varianceAmount || 0]] as const; return <div className="rounded-2xl border border-emerald-200 bg-white p-5"><h2 className="font-bold text-emerald-800">Kết quả đóng ca</h2><p className="text-sm text-slate-500">{shift.shiftCode} · {shift.cashierName} · {shift.businessDate}</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-bold">{money(value)}</dd></div>)}</dl>{shift.varianceReason && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm"><b>Lý do:</b> {shift.varianceReason}</p>}<button className="mt-5 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white" onClick={onNew}>Mở ca mới</button></div>; }

type Filters = { businessDate: string; cashierId: string; status: string; page: number };
function History({ items, total, filters, onFilters }: { items: RetailShift[]; total: number; filters: Filters; onFilters: React.Dispatch<React.SetStateAction<Filters>> }) { const set = (key: keyof Filters, value: string | number) => onFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 })); return <div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Lịch sử ca</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Ngày kinh doanh" type="date" value={filters.businessDate} onChange={(value) => set("businessDate", value)} /><Field label="Mã thu ngân" value={filters.cashierId} onChange={(value) => set("cashierId", value)} /><label className="block text-sm font-medium">Trạng thái ca<select aria-label="Trạng thái ca" className="mt-1 w-full rounded-xl border px-3 py-2" value={filters.status} onChange={(event) => set("status", event.target.value)}><option value="">Tất cả</option><option value="open">Đang mở</option><option value="closed">Đã đóng</option><option value="reconciled">Đã đối soát trước đây</option></select></label></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr><th className="p-2 text-left">Mã ca</th><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Thu ngân</th><th className="p-2">Trạng thái</th><th className="p-2 text-right">Thực đếm</th><th className="p-2 text-right">Chênh lệch</th></tr></thead><tbody>{items.map((item) => <tr key={item._id} className="border-t"><td className="p-2 font-semibold">{item.shiftCode}</td><td className="p-2">{item.businessDate}</td><td className="p-2">{item.cashierName}</td><td className="p-2 text-center">{statusLabel(item.status)}</td><td className="p-2 text-right">{item.countedCash == null ? "—" : money(item.countedCash)}</td><td className="p-2 text-right">{item.varianceAmount == null ? "—" : money(item.varianceAmount)}</td></tr>)}</tbody></table>{!items.length && <p className="py-8 text-center text-sm text-slate-500">Chưa có ca phù hợp.</p>}</div>{total > 20 && <div className="mt-4 flex justify-end gap-2"><button disabled={filters.page <= 1} onClick={() => set("page", filters.page - 1)}>Trang trước</button><button disabled={filters.page * 20 >= total} onClick={() => set("page", filters.page + 1)}>Trang sau</button></div>}</div>; }

type FieldProps = { label: string; value: string | number; onChange: (value: string) => void; type?: string; invalid?: boolean };
const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field({ label, value, onChange, type = "text", invalid = false }, ref) { return <label className="block text-sm font-medium">{label}<input ref={ref} aria-label={label} aria-invalid={invalid || undefined} type={type} className={`mt-1 w-full rounded-xl border px-3 py-2 ${invalid ? "border-red-500 ring-2 ring-red-100" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} /></label>; });
function Status({ value }: { value: RetailShift["status"] }) { return <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">{statusLabel(value)}</span>; }
