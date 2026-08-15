import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Ban, CheckCircle2, CreditCard, Download, Eye, FileDown, FileUp, RefreshCw, RotateCcw, X } from "lucide-react";
import type { WorkerScope } from "../../types";
import { laborPartnersApi } from "../api/laborPartners.api";
import type { LaborPartner, LaborPartnerReportSummary, LaborPartnerSettlement, SettlementDetail, SettlementFilters, WorkerReferral } from "../types";
import { downloadSettlementInputTemplate, parseSettlementImportFile, type SettlementManualValue } from "../utils/settlement-input";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
const currencyInput = (value: string | number) => {
  const digits = String(value).replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};
const currencyValue = (value: string) => Number(value.replace(/\D/g, ""));
const partnerName = (partner: LaborPartnerSettlement["partnerId"]) => typeof partner === "string" ? partner : `${partner.code} · ${partner.name}`;
const workerName = (worker: SettlementDetail["lines"][number]["workerId"]) => !worker ? "Điều chỉnh đối tác" : typeof worker === "string" ? worker : worker.fullName;
const statusLabel: Record<LaborPartnerSettlement["status"], string> = { draft: "Nháp", calculated: "Đã tính", approved: "Đã duyệt", partially_paid: "Chi trả một phần", paid: "Đã chi đủ", void: "Đã hủy" };

export function LaborPartnerSettlementsPanel({ scope, partners, workers, canCalculate, canApprove, canPayout, onSettlementCalculated }: { scope: WorkerScope; partners: LaborPartner[]; workers: Array<{ _id: string; fullName: string }>; canCalculate: boolean; canApprove: boolean; canPayout: boolean; onSettlementCalculated?: (partnerId: string) => void }) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [partnerId, setPartnerId] = useState("");
  const [periodAnchor, setPeriodAnchor] = useState(today());
  const [items, setItems] = useState<LaborPartnerSettlement[]>([]);
  const [summary, setSummary] = useState<LaborPartnerReportSummary | null>(null);
  const [filters, setFilters] = useState<SettlementFilters>({});
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"cash" | "bank_transfer">("bank_transfer");
  const [payoutReference, setPayoutReference] = useState("");
  const [referrals, setReferrals] = useState<WorkerReferral[]>([]);
  const [pendingReferralCount, setPendingReferralCount] = useState(0);
  const [manualEntries, setManualEntries] = useState<Record<string, SettlementManualValue>>({});
  const [bulkHours, setBulkHours] = useState("");
  const [bulkMonths, setBulkMonths] = useState("");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    if (!partnerId) { setReferrals([]); setPendingReferralCount(0); setManualEntries({}); setBulkHours(""); setBulkMonths(""); setImportMessage(""); return; }
    void laborPartnersApi.listReferrals(scope, partnerId).then((items) => {
      const active = items.filter((item) => item.status === "active");
      setReferrals(active);
      setPendingReferralCount(items.filter((item) => item.status === "pending").length);
      setManualEntries(Object.fromEntries(active.map((item) => [item._id, { officialMonths: "", seasonalHours: "" }])));
      setBulkHours(""); setBulkMonths(""); setImportMessage("");
    }).catch(() => { setReferrals([]); setPendingReferralCount(0); setManualEntries({}); });
  }, [partnerId, scope.companyCode, scope.branchId]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [settlements, reportSummary] = await Promise.all([laborPartnersApi.listSettlements(scope, filters), laborPartnersApi.dashboard(scope, filters)]); setItems(settlements); setSummary(reportSummary); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể tải danh sách đối soát."); }
    finally { setLoading(false); }
  }, [scope.companyCode, scope.branchId, filters.partnerId, filters.status, filters.scheme, filters.periodStart, filters.periodEnd]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!detail) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDetail(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detail]);

  const openDetail = async (id: string) => {
    setBusy(true); setMessage("");
    try { const value = await laborPartnersApi.settlementDetail(scope, id); setDetail(value); setPayoutAmount(currencyInput(value.balanceAmount)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể tải kỳ đối soát."); }
    finally { setBusy(false); }
  };
  const refreshDetail = async (id: string) => { await Promise.all([openDetail(id), load()]); };
  const applyBulkHours = () => {
    const value = Number(bulkHours.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) { setImportMessage("Số giờ áp dụng chung phải là số không âm."); return; }
    setManualEntries((current) => Object.fromEntries(referrals.map((referral) => [referral._id, referral.commissionScheme === "seasonal_hourly" ? { ...current[referral._id], seasonalHours: String(value) } : { ...current[referral._id] || { officialMonths: "", seasonalHours: "" } }])));
    setImportMessage(`Đã áp dụng ${value} giờ cho ${referrals.filter((referral) => referral.commissionScheme === "seasonal_hourly").length} lao động thời vụ.`);
  };
  const applyBulkMonths = () => {
    const value = Number(bulkMonths);
    if (!Number.isInteger(value) || value < 0 || value > 3) { setImportMessage("Số tháng áp dụng chung phải là số nguyên từ 0 đến 3."); return; }
    setManualEntries((current) => Object.fromEntries(referrals.map((referral) => [referral._id, referral.commissionScheme === "official_monthly" ? { ...current[referral._id], officialMonths: String(value) } : { ...current[referral._id] || { officialMonths: "", seasonalHours: "" } }])));
    setImportMessage(`Đã áp dụng mốc ${value} tháng cho ${referrals.filter((referral) => referral.commissionScheme === "official_monthly").length} lao động chính thức.`);
  };
  const importEntries = async (file: File) => {
    setBusy(true); setImportMessage(`Đang đọc ${file.name}...`);
    try {
      const result = await parseSettlementImportFile(file, referrals, workers);
      setManualEntries((current) => ({ ...current, ...result.values }));
      setImportMessage(result.errors.length ? `Đã nạp ${result.matchedCount} dòng, cần kiểm tra: ${result.errors.slice(0, 3).join(" ")}${result.errors.length > 3 ? ` Và còn ${result.errors.length - 3} lỗi khác.` : ""}` : `Đã nạp ${result.matchedCount} dòng từ ${file.name}.`);
    } catch (reason) { setImportMessage(reason instanceof Error ? reason.message : "Không thể đọc file nhập số công."); }
    finally { setBusy(false); }
  };
  const calculate = async (event: FormEvent) => {
    event.preventDefault(); if (!partnerId) return;
    if (!referrals.length) {
      setMessage(pendingReferralCount > 0
        ? `Đối tác còn ${pendingReferralCount} nguồn giới thiệu chờ xác nhận. Hãy xác nhận nguồn giới thiệu trước khi tính đối soát.`
        : "Đối tác chưa có nguồn giới thiệu đang hiệu lực để tính đối soát.");
      return;
    }
    setBusy(true); setMessage("Đang tính kỳ đối soát...");
    try {
      const entries = referrals.map((referral) => {
        const value = manualEntries[referral._id] || { officialMonths: "", seasonalHours: "" };
        return referral.commissionScheme === "official_monthly"
          ? { referralId: referral._id, officialMonths: Number(value.officialMonths || 0) }
          : { referralId: referral._id, seasonalHours: Number(value.seasonalHours || 0) };
      });
      const response: any = await laborPartnersApi.calculateSettlement(scope, { partnerId, periodAnchor, manualEntries: entries });
      const settlement = response?.settlement || response;
      setMessage(response?.reused ? "Kỳ đã tồn tại; dữ liệu hiện có đã được mở lại." : "Đã tạo kỳ đối soát từ dữ liệu nguồn hiện tại.");
      await load();
      if (settlement?._id) await openDetail(settlement._id);
      onSettlementCalculated?.(partnerId);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể tính đối soát."); }
    finally { setBusy(false); }
  };
  const approve = async () => {
    if (!detail) return;
    setBusy(true); setMessage("");
    try { await laborPartnersApi.approveSettlement(scope, detail._id, detail.version); setMessage("Đã duyệt kỳ đối soát và khóa các dòng hoa hồng."); await refreshDetail(detail._id); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể duyệt kỳ đối soát."); }
    finally { setBusy(false); }
  };
  const recalculate = async () => {
    if (!detail || !window.confirm("Tính lại kỳ này từ dữ liệu nguồn hiện tại? Các dòng nháp hiện có sẽ được thay thế.")) return;
    setBusy(true); setMessage("");
    try { await laborPartnersApi.recalculateSettlement(scope, detail._id); setMessage("Đã tính lại kỳ đối soát."); await refreshDetail(detail._id); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể tính lại kỳ."); }
    finally { setBusy(false); }
  };
  const voidSettlement = async () => {
    if (!detail) return; const reason = window.prompt("Lý do hủy kỳ đối soát (không bắt buộc):"); if (reason === null) return;
    setBusy(true); setMessage("");
    try { await laborPartnersApi.voidSettlement(scope, detail._id, detail.version, reason); setMessage("Đã hủy kỳ đối soát."); await refreshDetail(detail._id); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể hủy kỳ."); }
    finally { setBusy(false); }
  };
  const createAdjustment = async () => {
    if (!detail) return;
    const rawAmount = window.prompt("Số tiền điều chỉnh VND (dương: trả thêm, âm: giảm trừ):"); if (rawAmount === null) return;
    const reason = window.prompt("Lý do điều chỉnh:"); if (!reason) return;
    const periodAnchor = window.prompt("Ngày thuộc kỳ điều chỉnh (YYYY-MM-DD):", today()); if (!periodAnchor) return;
    setBusy(true); setMessage("");
    try { await laborPartnersApi.createAdjustment(scope, detail._id, { amount: Number(rawAmount), reason, periodAnchor, idempotencyKey: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` }); setMessage("Đã tạo kỳ điều chỉnh mới ở trạng thái chờ duyệt."); await load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể tạo điều chỉnh."); }
    finally { setBusy(false); }
  };
  const payout = async (event: FormEvent) => {
    event.preventDefault(); if (!detail) return;
    setBusy(true); setMessage("");
    try {
      await laborPartnersApi.createPayout(scope, detail._id, { amount: currencyValue(payoutAmount), method: payoutMethod, reference: payoutReference, idempotencyKey: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` });
      setMessage("Đã ghi nhận chi trả."); setPayoutReference(""); await refreshDetail(detail._id);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể ghi nhận chi trả."); }
    finally { setBusy(false); }
  };
  const reverse = async (id: string) => {
    if (!detail || !window.confirm("Hoàn tác giao dịch chi trả này?")) return;
    setBusy(true); setMessage("");
    try { await laborPartnersApi.reversePayout(scope, id); setMessage("Đã hoàn tác giao dịch chi trả."); await refreshDetail(detail._id); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể hoàn tác giao dịch."); }
    finally { setBusy(false); }
  };
  const downloadReport = async () => {
    setBusy(true); setMessage("");
    try { await laborPartnersApi.downloadCommissionReport(scope, filters); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể xuất báo cáo."); }
    finally { setBusy(false); }
  };

  return <section className={`grid gap-5 xl:grid-cols-1 ${detail ? "[&>aside]:fixed [&>aside]:inset-0 [&>aside]:z-50 [&>aside]:m-auto [&>aside]:h-fit [&>aside]:max-h-[85vh] [&>aside]:w-[calc(100%-2rem)] [&>aside]:max-w-2xl [&>aside]:overflow-y-auto [&>aside]:bg-white [&>aside]:shadow-[0_0_0_100vmax_rgba(15,23,42,0.45)]" : "[&>aside]:hidden"}`}>
     <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
<div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-800">Kỳ đối soát hoa hồng</h2><p className="mt-1 text-xs leading-5 text-slate-500">Cộng tổng số giờ của toàn bộ lao động trong tháng rồi áp dụng đơn giá theo bậc.</p></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void downloadReport()} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 px-2.5 py-2 text-xs font-bold text-cyan-700 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Bảng tính</button><button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500"><RefreshCw className="h-4 w-4" /></button></div></div>
      {summary && <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2"><dt className="text-[11px] text-slate-500">Phát sinh</dt><dd className="mt-1 text-sm font-black">{money(summary.accruedAmount)}</dd></div><div className="rounded-lg bg-emerald-50 p-2"><dt className="text-[11px] text-emerald-700">Đã duyệt</dt><dd className="mt-1 text-sm font-black text-emerald-800">{money(summary.approvedAmount)}</dd></div><div className="rounded-lg bg-violet-50 p-2"><dt className="text-[11px] text-violet-700">Đã chi</dt><dd className="mt-1 text-sm font-black text-violet-800">{money(summary.paidAmount)}</dd></div><div className="rounded-lg bg-cyan-50 p-2"><dt className="text-[11px] text-cyan-700">Còn phải chi</dt><dd className="mt-1 text-sm font-black text-cyan-800">{money(summary.balanceAmount)}</dd></div></dl>}
      <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3"><label className="grid gap-1 text-xs font-bold text-slate-600">Đối tác<select value={filters.partnerId || ""} onChange={(event) => setFilters((value) => ({ ...value, partnerId: event.target.value || undefined }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Tất cả</option>{partners.map((partner) => <option key={partner._id} value={partner._id}>{partner.code} · {partner.name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Trạng thái<select value={filters.status || ""} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value as SettlementFilters["status"] || undefined }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Tất cả</option><option value="calculated">Đã tính</option><option value="approved">Đã duyệt</option><option value="partially_paid">Chi một phần</option><option value="paid">Đã chi đủ</option><option value="void">Đã hủy</option></select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Cơ chế<select value={filters.scheme || ""} onChange={(event) => setFilters((value) => ({ ...value, scheme: event.target.value as SettlementFilters["scheme"] || undefined }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Tất cả</option><option value="official_monthly">Chính thức</option><option value="seasonal_hourly">Thời vụ</option></select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Từ ngày<input type="date" value={filters.periodStart || ""} onChange={(event) => setFilters((value) => ({ ...value, periodStart: event.target.value || undefined }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Đến ngày<input type="date" value={filters.periodEnd || ""} onChange={(event) => setFilters((value) => ({ ...value, periodEnd: event.target.value || undefined }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" /></label><button type="button" onClick={() => setFilters({})} className="h-8 self-end rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600">Xóa lọc</button></div>
{canCalculate && <form onSubmit={(event) => void calculate(event)} className="mt-4 grid gap-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Đối tác *<select required value={partnerId} onChange={(event) => { setPartnerId(event.target.value); setMessage(""); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Chọn...</option>{partners.map((partner) => <option key={partner._id} value={partner._id}>{partner.code} · {partner.name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Tháng tính hoa hồng (chọn ngày trong tháng) *<input required type="date" value={periodAnchor} onChange={(event) => setPeriodAnchor(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label>{partnerId && referrals.length === 0 && <p role="alert" className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{pendingReferralCount > 0 ? `Có ${pendingReferralCount} nguồn giới thiệu đang chờ xác nhận. Hãy vào tab Đối tác, mở chi tiết đối tác và bấm Xác nhận trước khi tính đối soát.` : "Đối tác chưa có nguồn giới thiệu đang hiệu lực để tính đối soát."}</p>}{partnerId && referrals.length > 0 && <div className="sm:col-span-2 grid gap-2 rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-black text-slate-700">Dữ liệu tính hoa hồng theo từng lao động</p><p className="text-[11px] leading-5 text-slate-500">Thời vụ nhập số giờ thực tế trong tháng; chính thức nhập số tháng đạt mốc. Đây là dữ liệu nhập tay dùng để tính kỳ đối soát.</p>{referrals.map((referral) => { const value = manualEntries[referral._id] || { officialMonths: "", seasonalHours: "" }; const worker = workers.find((item) => item._id === referral.workerId); return <div key={referral._id} className="grid items-end gap-2 sm:grid-cols-[1fr_160px]"><span className="text-xs text-slate-600">{worker?.fullName || referral.workerId} · {referral.commissionScheme === "official_monthly" ? "Số tháng đạt được" : "Số giờ trong tháng"}</span>{referral.commissionScheme === "official_monthly" ? <input aria-label={`Số tháng của ${worker?.fullName || referral.workerId}`} type="number" min="0" max="3" step="1" value={value.officialMonths} onChange={(event) => setManualEntries((current) => ({ ...current, [referral._id]: { ...value, officialMonths: event.target.value } }))} className="h-9 rounded-lg border border-slate-200 px-3 text-sm" placeholder="0" /> : <input aria-label={`Số giờ của ${worker?.fullName || referral.workerId}`} type="number" min="0" step="0.01" value={value.seasonalHours} onChange={(event) => setManualEntries((current) => ({ ...current, [referral._id]: { ...value, seasonalHours: event.target.value } }))} className="h-9 rounded-lg border border-slate-200 px-3 text-sm" placeholder="0" />}</div>; })}</div>}<button disabled={!partnerId || !referrals.length || busy} className="h-9 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2">Tính / mở kỳ đối soát</button></form>}
      {partnerId && referrals.length > 0 && <section className="mt-3 grid gap-2 rounded-xl border border-cyan-100 bg-cyan-50/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-slate-700">Nhập nhanh số công</p><p className="text-[11px] text-slate-500">Dùng giá trị chung hoặc nạp file theo Mã lao động; không lấy dữ liệu chấm công nội bộ.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setBusy(true); void downloadSettlementInputTemplate(referrals, workers).catch((reason) => setImportMessage(reason instanceof Error ? reason.message : "Không thể tạo file mẫu.")).finally(() => setBusy(false)); }} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 disabled:opacity-50"><FileDown className="h-3.5 w-3.5" /> Tải mẫu Excel</button><button type="button" disabled={busy} onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"><FileUp className="h-3.5 w-3.5" /> Nhập Excel/CSV</button><input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" disabled={busy} onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; input.value = ""; if (file) void importEntries(file); }} /></div></div>
        <div className="grid gap-2 sm:grid-cols-2"><div className="flex gap-2"><input aria-label="Số giờ áp dụng cho tất cả lao động thời vụ" type="number" min="0" step="0.01" value={bulkHours} onChange={(event) => setBulkHours(event.target.value)} placeholder="Số giờ cho tất cả thời vụ" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs" /><button type="button" disabled={busy || !bulkHours} onClick={applyBulkHours} className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[11px] font-bold text-cyan-700 disabled:opacity-50">Áp dụng giờ</button></div><div className="flex gap-2"><input aria-label="Số tháng áp dụng cho tất cả lao động chính thức" type="number" min="0" max="3" step="1" value={bulkMonths} onChange={(event) => setBulkMonths(event.target.value)} placeholder="Số tháng cho tất cả chính thức" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs" /><button type="button" disabled={busy || !bulkMonths} onClick={applyBulkMonths} className="h-8 rounded-lg border border-cyan-200 bg-white px-2 text-[11px] font-bold text-cyan-700 disabled:opacity-50">Áp dụng tháng</button></div></div>
        {importMessage && <p role="status" className="text-[11px] leading-4 text-cyan-800">{importMessage}</p>}
      </section>}
      {message && <p role="status" className="mt-3 text-sm font-medium text-cyan-700">{message}</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="p-2">Kỳ</th><th className="p-2">Đối tác</th><th className="p-2 text-right">Tổng tiền</th><th className="p-2">Trạng thái</th><th className="p-2" /></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="p-5 text-center text-slate-400">Đang tải...</td></tr> : items.length === 0 ? <tr><td colSpan={5} className="p-5 text-center text-slate-400">Chưa có kỳ đối soát.</td></tr> : items.map((item) => <tr key={item._id} className="border-b border-slate-100"><td className="p-2 font-medium text-slate-700">{item.periodStart} → {item.periodEnd}</td><td className="p-2 text-slate-600">{partnerName(item.partnerId)}</td><td className="p-2 text-right font-bold text-slate-800">{money(item.totalAmount)}</td><td className="p-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{statusLabel[item.status]}</span></td><td className="p-2 text-right"><button type="button" onClick={() => void openDetail(item._id)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 px-2 py-1.5 text-xs font-bold text-cyan-700"><Eye className="h-3.5 w-3.5" /> Xem</button></td></tr>)}</tbody></table></div>
    </div>
    <aside className="relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      {detail && <button type="button" aria-label="Đóng rà soát chi trả" onClick={() => setDetail(null)} className="absolute right-4 top-16 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"><X className="h-5 w-5" /></button>}
      {!detail ? <div className="py-16 text-center text-sm text-slate-400">Chọn một kỳ để xem các dòng hoa hồng, duyệt và chi trả.</div> : <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-cyan-700">{statusLabel[detail.status]}</p><h3 className="mt-1 font-black text-slate-800">{detail.periodStart} → {detail.periodEnd}</h3><p className="mt-1 text-sm text-slate-500">{partnerName(detail.partnerId)}</p></div><div className="flex flex-wrap justify-end gap-2">{canCalculate && (detail.status === "draft" || detail.status === "calculated") && <button disabled={busy} type="button" onClick={() => void recalculate()} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 px-2.5 py-2 text-xs font-bold text-cyan-700 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Tính lại</button>}{canApprove && detail.status === "calculated" && <button disabled={busy} type="button" onClick={() => void approve()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Duyệt</button>}{canApprove && (detail.status === "draft" || detail.status === "calculated") && <button disabled={busy} type="button" onClick={() => void voidSettlement()} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"><Ban className="h-3.5 w-3.5" /> Hủy kỳ</button>}</div></div>
        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">Tổng phải trả</dt><dd className="mt-1 font-black">{money(detail.totalAmount)}</dd></div><div><dt className="text-xs text-slate-500">Còn phải trả</dt><dd className="mt-1 font-black text-cyan-700">{money(detail.balanceAmount)}</dd></div><div><dt className="text-xs text-slate-500">Chính thức</dt><dd className="mt-1 font-bold">{money(detail.officialAmount)}</dd></div><div><dt className="text-xs text-slate-500">Thời vụ</dt><dd className="mt-1 font-bold">{money(detail.seasonalAmount)}</dd></div></dl>
        {canPayout && (detail.status === "approved" || detail.status === "partially_paid") && <form onSubmit={(event) => void payout(event)} className="mt-4 grid gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3"><p className="inline-flex items-center gap-1 text-sm font-black text-slate-800"><CreditCard className="h-4 w-4 text-violet-600" /> Ghi nhận chi trả</p><label className="grid gap-1 text-xs font-bold text-slate-600">Số tiền (VND) *<input required inputMode="numeric" pattern="[0-9.]*" value={payoutAmount} onChange={(event) => setPayoutAmount(currencyInput(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Phương thức<select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as "cash" | "bank_transfer")} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="bank_transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option></select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Mã tham chiếu<input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><button disabled={busy || !payoutAmount} className="h-9 rounded-lg bg-violet-600 text-xs font-bold text-white disabled:opacity-50">Xác nhận chi trả</button></form>}
        {detail.warnings && detail.warnings.length > 0 && <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><h4 className="text-sm font-black text-amber-800">Cảnh báo dữ liệu</h4>{detail.warnings.map((warning, index) => <p key={index} className="mt-1 text-xs text-amber-700">{warning.message || warning.code || "Có dữ liệu cần kiểm tra."}</p>)}</section>}
        <section className="mt-5"><h4 className="text-sm font-black text-slate-800">Dòng hoa hồng ({detail.lines.length})</h4><div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-100">{detail.lines.map((line) => <div key={line._id} className="border-b border-slate-100 p-2 text-xs last:border-0"><div className="flex justify-between gap-3"><span className="font-bold text-slate-700">{workerName(line.workerId)}</span><span className="font-black text-slate-800">{money(line.amount)}</span></div><p className="mt-1 text-slate-500">{line.scheme === "official_monthly" ? `Mốc tháng ${line.officialMilestone}` : line.scheme === "seasonal_hourly" ? `${Math.round((line.eligibleMinutes || 0) / 60 * 100) / 100} giờ · ${money(line.hourlyRate || 0)}/giờ` : "Điều chỉnh từ kỳ đã duyệt"}</p><p className="mt-1 text-slate-400">{line.explanation}{line.sourceAttendanceLogIds?.length ? ` · ${line.sourceAttendanceLogIds.length} bản chấm công` : ""}{line.sourceContractId ? " · Có hợp đồng nguồn" : ""}</p></div>)}</div></section>
        <section className="mt-5"><h4 className="text-sm font-black text-slate-800">Lịch sử chi trả</h4>{detail.payouts.length === 0 ? <p className="mt-2 text-xs text-slate-400">Chưa có giao dịch.</p> : <div className="mt-2 grid gap-2">{detail.payouts.map((record) => <div key={record._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2 text-xs"><div><p className="font-bold text-slate-700">{money(record.amount)} · {record.method === "bank_transfer" ? "Chuyển khoản" : "Tiền mặt"}</p><p className="mt-0.5 text-slate-400">{new Date(record.paidAt).toLocaleString("vi-VN")}</p></div>{canPayout && record.amount > 0 && !record.reversalOfPayoutId && <button disabled={busy} type="button" onClick={() => void reverse(record._id)} className="text-xs font-bold text-rose-600">Hoàn tác</button>}</div>)}</div>}</section>
      </>}
    </aside>
  </section>;
}
