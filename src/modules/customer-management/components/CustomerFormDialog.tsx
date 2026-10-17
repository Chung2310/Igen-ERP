import React from "react";
import { Save, X } from "lucide-react";
import { VietnameseDatePicker } from "../../student-management/components/Batches/VietnameseDatePicker";
import { RoadmapPicker } from "../../student-management/components/ui/RoadmapPicker";
import type { Customer, CustomerInput } from "../types";

const empty: CustomerInput = { name: "", phone: "", type: "regular", email: "", dateOfBirth: "", address: "", notes: "" };
const inputClass = "mt-1.5 h-9 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10";

export default function CustomerFormDialog({ customer, onClose, onSave }: { customer?: Customer; onClose: () => void; onSave: (input: CustomerInput) => Promise<void> }) {
  const [form, setForm] = React.useState<CustomerInput>({ ...empty, ...customer, dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const field = (key: keyof CustomerInput, label: string, type = "text") => (
    <label className="block text-xs font-medium text-slate-700">
      <span>{label}{(key === "name" || key === "phone") && <span className="ml-1 text-rose-500">*</span>}</span>
      <input type={type} required={key === "name" || key === "phone"} value={String(form[key] || "")} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-5">
      <form onSubmit={(event) => { event.preventDefault(); setSaving(true); setError(""); void onSave(form).catch((cause) => setError(cause instanceof Error ? cause.message : "Không lưu được khách hàng.")).finally(() => setSaving(false)); }} className="flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-brand-primary" aria-hidden="true" />
            <h2 id="customer-form-title" className="text-base font-medium text-slate-900">{customer ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng"}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-800">Thông tin cơ bản</h3>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {field("name", "Họ và tên")}
              {field("phone", "Số điện thoại")}
              {field("email", "Email", "email")}
              <label className="block text-xs font-medium text-slate-700"><span>Ngày sinh</span><div className="mt-1.5"><VietnameseDatePicker ariaLabel="Ngày sinh" value={form.dateOfBirth} onChange={(dateOfBirth) => setForm((current) => ({ ...current, dateOfBirth }))} selectionOnly /></div></label>
              <label className="block text-xs font-medium text-slate-700"><span>Loại khách</span><div className="mt-1.5"><RoadmapPicker value={form.type} onChange={(type) => setForm((current) => ({ ...current, type: type as CustomerInput["type"] }))} placeholder="Chọn loại khách" allowClear={false} portal options={[{ value: "regular", label: "Khách thường" }, { value: "vat", label: "Khách xuất VAT" }]} /></div></label>
              {field("address", "Địa chỉ")}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3"><h3 className="mb-3 text-sm font-medium text-slate-800">Thông tin bổ sung</h3>{field("notes", "Ghi chú")}</div>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-normal text-slate-600 transition hover:bg-slate-50">Hủy</button>
          <button disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Đang lưu..." : "Lưu khách hàng"}</button>
        </div>
      </form>
    </div>
  );
}
