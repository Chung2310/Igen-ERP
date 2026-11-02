import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Gift, Sparkles, X } from "lucide-react";
import { retailCouponsApi, type RetailCouponAutomationInput, type RetailCouponAutomation } from "../../api/retailCoupons.api";
import type { RetailScope } from "../../types";

export default function CouponAutomationEditor({ scope, initial, onClose, onSaved }: { scope: RetailScope; initial: RetailCouponAutomationInput & Partial<Pick<RetailCouponAutomation, "_id" | "legacy">>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) closeRef.current?.();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const update = (patch: Partial<RetailCouponAutomationInput>) => { setForm(current => current && ({ ...current, ...patch })); };
  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100 disabled:text-slate-500";
  const labelClass = "mb-1 block text-xs font-semibold text-slate-700";
  const money = (value: number) => value.toLocaleString("vi-VN") + " ₫";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl outline-none animate-in zoom-in-95">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">{initial._id ? "Sửa chương trình tặng mã" : "Tạo chương trình tặng mã"}</h2>
              <p className="text-xs text-slate-500">Cấu hình điều kiện và giá trị áp dụng cho khách hàng</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng chương trình tặng mã" disabled={busy} onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div role="alert" className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <div><p>{error}</p><button type="button" disabled={busy} onClick={onClose} className="mt-1 font-semibold underline disabled:opacity-50">Quay lại danh sách</button></div>
        </div>}

        <form className="space-y-5 p-6" onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          setBusy(true); setError("");
          try { await retailCouponsApi.saveAutomation(scope, form, initial._id); onSaved(); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được chương trình."); }
          finally { setBusy(false); }
        }}>
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-cyan-300 bg-gradient-to-r from-cyan-50/70 via-sky-50/60 to-blue-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-wide text-cyan-800"><Gift className="h-4 w-4" aria-hidden="true" />Ưu đãi tự động</span>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{form.name || "Tên chương trình tặng mã"}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-cyan-600 px-3 py-1 text-sm font-black text-white shadow-xs">
                -{form.discountType === "percent" ? form.value + "%" : money(form.value)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>Đơn từ: <strong className="text-slate-700">{money(form.minSubtotal)}</strong></span>
              {form.maxDiscount != null && <span>Giảm tối đa: <strong className="text-slate-700">{money(form.maxDiscount)}</strong></span>}
              <span>Hiệu lực: <strong className="text-slate-700">{form.validityDays} ngày</strong></span>
            </div>
          </div>

          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelClass}>Tên chương trình
              <input className={inputClass} required maxLength={120} disabled={initial.legacy} placeholder="VD: Tặng mã cho đơn từ 2 triệu" value={form.name} onChange={event => update({ name: event.target.value })} />
            </label></div>
            <div className="sm:col-span-2"><label className={labelClass}>Hoạt động tặng mã
              <select className={inputClass} disabled={Boolean(initial._id)} value={form.trigger} onChange={event => update({ trigger: event.target.value as RetailCouponAutomationInput["trigger"], orderMinTotal: event.target.value === "order_total" ? 1000000 : null })}>
                <option value="birthday">Sinh nhật khách hàng</option>
                <option value="order_total">Đơn hàng đạt mức tiền</option>
              </select>
            </label></div>
            {form.trigger === "order_total" && <div className="sm:col-span-2"><label className={labelClass}>Giá trị đơn tối thiểu để tặng mã (₫)
              <input className={inputClass} type="number" min="1" step="1" required value={form.orderMinTotal ?? ""} onChange={event => update({ orderMinTotal: event.target.value ? Number(event.target.value) : null })} />
            </label><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Xét từng đơn đã thanh toán đủ, gồm thuế và phí giao hàng, trừ tiền hoàn. Mỗi đơn đạt mức tiền được tặng một mã cho lần mua sau.</p></div>}
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-700 select-none">
                <input type="checkbox" className="h-4 w-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  checked={form.enabled} onChange={event => update({ enabled: event.target.checked })} />
                Bật chương trình tự động
              </label>
              <p className="pl-6.5 text-[11px] leading-relaxed text-slate-500">Áp dụng tại chi nhánh hiện tại. Mã dành riêng cho người nhận và hiển thị tại POS khi chọn khách.</p>
            </div>

            <div><label className={labelClass}>Loại giảm của mã được tặng
              <select className={inputClass} value={form.discountType} onChange={event => update({ discountType: event.target.value as "amount" | "percent", value: event.target.value === "percent" ? 10 : 50000 })}>
                <option value="percent">Phần trăm (%)</option><option value="amount">Số tiền cố định (₫)</option>
              </select>
            </label></div>
            <div><label className={labelClass}>Mức giảm của mã được tặng
              <input className={inputClass} type="number" required min={form.discountType === "percent" ? 0.01 : 1} max={form.discountType === "percent" ? 100 : undefined} step={form.discountType === "percent" ? 0.01 : 1}
                value={form.value} onChange={event => update({ value: Number(event.target.value) })} />
            </label></div>
            <div><label className={labelClass}>Đơn tối thiểu để sử dụng mã (₫)
              <input className={inputClass} type="number" required min="0" step="1" value={form.minSubtotal} onChange={event => update({ minSubtotal: Number(event.target.value) })} />
            </label></div>
            <div><label className={labelClass}>Trần giảm của mã được tặng (₫)
              <input className={inputClass} type="number" min="1" step="1" placeholder="Không giới hạn" value={form.maxDiscount ?? ""} onChange={event => update({ maxDiscount: event.target.value === "" ? null : Number(event.target.value) })} />
            </label></div>
            <div><label className={labelClass}>Hiệu lực (ngày)
              <input className={inputClass} type="number" required min="1" max="90" step="1" value={form.validityDays} onChange={event => update({ validityDays: Number(event.target.value) })} />
            </label><p className="mt-1 text-[11px] text-slate-400">{form.trigger === "birthday" ? "Từ 1 đến 90 ngày, tính từ ngày sinh nhật." : "Từ 1 đến 90 ngày, tính từ khi đơn hoàn tất thanh toán."}</p></div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:col-span-2">
              <h3 className="text-xs font-bold text-slate-700">Gửi mã cho khách hàng</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-200 bg-white p-3 text-xs font-semibold text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-cyan-600" checked={form.deliveryChannels?.includes("email") ?? false} onChange={event => update({ deliveryChannels: event.target.checked ? ["email"] : [] })} />Email
                </label>
                {["Zalo", "Số điện thoại (SMS)"].map(channel => <label key={channel} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-400">
                  <input type="checkbox" disabled className="mt-0.5 h-4 w-4" /><span>{channel}<span className="mt-1 block text-[10px]">Đang phát triển</span></span>
                </label>)}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Email được gửi tự động đến địa chỉ trong hồ sơ khách, bằng cấu hình email (SMTP) của công ty. Cần cấu hình SMTP trước khi bật gửi. Khách chưa có email vẫn được cấp mã tại POS nhưng không nhận thư.</p>
              <p className="text-[11px] leading-relaxed text-slate-500">Chỉ gửi mã mới được cấp sau khi chọn Email, trong vòng khoảng 5 phút. Không chọn kênh thì mã chỉ hiển thị tại POS.</p>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:col-span-2">
              <h3 className="text-xs font-bold text-slate-700">Điều kiện tặng mã</h3>
              <p className="text-[11px] leading-relaxed text-slate-500">{form.trigger === "birthday" ? "Mỗi khách được tặng một mã mỗi năm theo chương trình. Tính từ 00:00 ngày sinh nhật theo giờ Việt Nam; ngày 29/2 nhận quà ngày 28/2 trong năm không nhuận." : "Chỉ xét đơn hoàn tất thanh toán sau khi bật chương trình. Nếu đơn gốc bị hủy hoặc hoàn tiền xuống dưới mức yêu cầu, mã chưa dùng sẽ không còn áp dụng được."}</p>
              <p className="text-[11px] leading-relaxed text-slate-500">Mã tặng chỉ dùng một lần bởi đúng người nhận. Các chương trình được bật có thể cùng tặng mã; mỗi đơn mua sau chỉ áp dụng một mã. Thay đổi cấu hình chỉ áp dụng cho mã chưa cấp; tắt chương trình không thu hồi mã đã tặng.</p>
            </div>
          </fieldset>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Đóng</button>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50">
                {busy ? "Đang lưu…" : "Lưu chương trình"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>, document.body,
  );
}
