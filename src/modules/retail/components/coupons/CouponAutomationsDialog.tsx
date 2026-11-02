import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Gift, Plus, Sparkles, X } from "lucide-react";
import { retailCouponsApi, type RetailCouponAutomation, type RetailCouponAutomationInput } from "../../api/retailCoupons.api";
import type { RetailScope } from "../../types";
import CouponAutomationEditor from "./CouponAutomationEditor";

const newProgram = (): RetailCouponAutomationInput => ({ name: "", trigger: "birthday", orderMinTotal: null, enabled: false,
  discountType: "percent", value: 10, minSubtotal: 0, maxDiscount: null, validityDays: 7, version: 0 });
type EditorValue = RetailCouponAutomationInput & Partial<Pick<RetailCouponAutomation, "_id" | "legacy">>;
export default function CouponAutomationsDialog({ scope, onClose }: { scope: RetailScope; onClose: () => void }) {
  const [items, setItems] = useState<RetailCouponAutomation[]>([]);
  const [editing, setEditing] = useState<EditorValue | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const stateRef = useRef({ busy, onClose }); stateRef.current = { busy, onClose };
  const titleId = useId();
  useEffect(() => {
    if (editing) return;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!stateRef.current.busy) stateRef.current.onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); focus?.focus(); };
  }, [Boolean(editing)]);
  useEffect(() => {
    let current = true; setLoading(true); setError("");
    retailCouponsApi.automations(scope).then(rows => { if (current) setItems(rows); })
      .catch(cause => { if (current) setError(cause.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [scope.companyCode, scope.branchId, revision]);
  if (editing) return <CouponAutomationEditor scope={scope} initial={editing} onClose={() => { setEditing(null); setRevision(value => value + 1); }} onSaved={() => { setEditing(null); setRevision(value => value + 1); setMessage("Đã lưu chương trình tặng mã."); }} />;
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl outline-none">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4.5">
        <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><Sparkles className="h-5 w-5" /></div>
          <div><h2 id={titleId} className="text-base font-bold text-slate-900">Tự động tặng mã ưu đãi</h2><p className="text-xs text-slate-500">Thiết lập chương trình theo hoạt động của khách hàng</p></div></div>
        <button type="button" aria-label="Đóng chương trình tự động" disabled={Boolean(busy)} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Có thể bật nhiều chương trình cùng lúc tại chi nhánh này.</p>
          <button type="button" disabled={Boolean(busy)} onClick={() => setEditing(newProgram())} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4" />Thêm chương trình</button></div>
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" /><div>{error} <button type="button" onClick={() => setRevision(value => value + 1)} className="underline">Tải lại</button></div></div>}
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</p>}
        {loading ? <p className="text-sm text-slate-500">Đang tải chương trình…</p> : items.length ? <div className="space-y-3">{items.map(program => <article key={program._id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">{program.name}</h3><p className="mt-1 text-xs text-slate-500">{program.trigger === "birthday" ? "Sinh nhật · Một mã/khách/năm" : `Đơn đã thanh toán từ ${(program.orderMinTotal || 0).toLocaleString("vi-VN")} ₫ · Một mã/đơn`}</p></div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${program.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{program.enabled ? "Đang bật" : "Đang tắt"}</span></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-cyan-800">Tặng mã giảm {program.discountType === "percent" ? `${program.value}%` : `${program.value.toLocaleString("vi-VN")} ₫`} · Hiệu lực {program.validityDays} ngày</p>
            <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => setEditing(program)} aria-label={`Sửa chương trình ${program.name}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">Sửa</button>
              <button type="button" disabled={Boolean(busy)} className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 disabled:opacity-50" onClick={async () => {
                setBusy(program._id); setError(""); setMessage("");
                try { await retailCouponsApi.saveAutomation(scope, { ...program, enabled: !program.enabled }, program._id); setRevision(value => value + 1); }
                catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được chương trình."); }
                finally { setBusy(null); }
              }}>{busy === program._id ? "Đang lưu…" : program.enabled ? "Tắt" : "Bật"}</button></div></div>
        </article>)}</div> : !error && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><Gift className="mx-auto mb-3 h-8 w-8 text-cyan-500" /><p className="text-sm font-semibold text-slate-700">Chưa có chương trình tự động</p><p className="mt-1 text-xs text-slate-500">Thêm quà sinh nhật hoặc ưu đãi cho đơn hàng đạt mức tiền.</p></div>}
        <div className="flex justify-end border-t border-slate-100 pt-4"><button type="button" disabled={Boolean(busy)} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700">Đóng</button></div>
      </div>
    </section>
  </div>, document.body);
}
