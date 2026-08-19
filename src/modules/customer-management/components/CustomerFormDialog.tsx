import React from "react";
import { X } from "lucide-react";
import type { Customer, CustomerInput } from "../types";

const empty: CustomerInput = { name: "", phone: "", type: "regular", email: "", dateOfBirth: "", address: "", notes: "" };

export default function CustomerFormDialog({ customer, onClose, onSave }: { customer?: Customer; onClose: () => void; onSave: (input: CustomerInput) => Promise<void> }) {
  const [form, setForm] = React.useState<CustomerInput>({ ...empty, ...customer, dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const field = (key: keyof CustomerInput, label: string, type = "text") => <label className="block text-sm font-semibold"><span>{label}</span><input type={type} required={key === "name" || key === "phone"} value={String(form[key] || "")} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={(event) => { event.preventDefault(); setSaving(true); setError(""); void onSave(form).catch((cause) => setError(cause instanceof Error ? cause.message : "Không lưu được khách hàng.")).finally(() => setSaving(false)); }} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{customer ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng"}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></div>
    <div className="grid gap-4 sm:grid-cols-2">{field("name", "Họ và tên")}{field("phone", "Số điện thoại")}{field("email", "Email", "email")}{field("dateOfBirth", "Ngày sinh", "date")}<label className="block text-sm font-semibold"><span>Loại khách</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CustomerInput["type"] }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="regular">Khách thường</option><option value="vat">Khách xuất VAT</option></select></label>{field("address", "Địa chỉ")}</div>
    {field("notes", "Ghi chú")}{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={saving} className="w-full rounded-xl bg-cyan-600 py-2.5 font-bold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu khách hàng"}</button>
  </form></div>;
}
