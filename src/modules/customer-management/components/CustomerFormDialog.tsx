import React from "react";
import { X } from "lucide-react";
import type { Customer, CustomerInput } from "../types";

const empty: CustomerInput = { name: "", phone: "", type: "regular", email: "", dateOfBirth: "", address: "", notes: "" };
const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100";

export default function CustomerFormDialog({ customer, onClose, onSave }: { customer?: Customer; onClose: () => void; onSave: (input: CustomerInput) => Promise<void> }) {
  const [form, setForm] = React.useState<CustomerInput>({ ...empty, ...customer, dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const field = (key: keyof CustomerInput, label: string, type = "text") => (
    <label className="block text-xs font-semibold text-slate-700">
      <span>{label}{(key === "name" || key === "phone") && <span className="ml-1 text-rose-500">*</span>}</span>
      <input type={type} required={key === "name" || key === "phone"} value={String(form[key] || "")} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-5">
      <form onSubmit={(event) => { event.preventDefault(); setSaving(true); setError(""); void onSave(form).catch((cause) => setError(cause instanceof Error ? cause.message : "Không lưu được khách hàng.")).finally(() => setSaving(false)); }} className="flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-7 w-1 rounded-full bg-[#00adfc]" aria-hidden="true" />
            <div><h2 id="customer-form-title" className="text-lg font-semibold text-slate-900">{customer ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng"}</h2><p className="mt-1 text-xs text-slate-500">Thông tin khách hàng dùng chung trong toàn công ty</p></div>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Thông tin cơ bản</h3>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {field("name", "Họ và tên")}
              {field("phone", "Số điện thoại")}
              {field("email", "Email", "email")}
              {field("dateOfBirth", "Ngày sinh", "date")}
              <label className="block text-xs font-semibold text-slate-700"><span>Loại khách</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CustomerInput["type"] }))} className={inputClass}><option value="regular">Khách thường</option><option value="vat">Khách xuất VAT</option></select></label>
              {field("address", "Địa chỉ")}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-sm font-semibold text-slate-800">Thông tin bổ sung</h3>{field("notes", "Ghi chú")}</div>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Hủy</button>
          <button disabled={saving} className="rounded-lg bg-[#00ADFC] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0095d9] disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu khách hàng"}</button>
        </div>
      </form>
    </div>
  );
}
