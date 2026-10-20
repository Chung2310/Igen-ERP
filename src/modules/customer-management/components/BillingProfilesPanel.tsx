import React from "react";
import { Plus } from "lucide-react";
import { customerApi } from "../customerApi";
import type { BillingProfileInput } from "../types";

const empty: BillingProfileInput = { legalName: "", taxId: "", address: "", invoiceEmail: "", contactName: "" };

export default function BillingProfilesPanel({ customerId, companyCode, canManage }: { customerId: string; companyCode: string; canManage: boolean }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState(empty);
  const [message, setMessage] = React.useState("");
  const load = React.useCallback(() => customerApi.billingProfiles(customerId, companyCode).then(setItems), [customerId, companyCode]);
  React.useEffect(() => { void load(); }, [load]);
  return (
    <section className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-slate-800">Thông tin xuất VAT</h3><p className="mt-1 text-xs text-slate-500">Hồ sơ dùng cho hóa đơn của khách hàng</p></div>
        {canManage && <button type="button" onClick={() => setAdding(!adding)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#007eb8] transition hover:bg-sky-100"><Plus className="h-3.5 w-3.5" />Thêm hồ sơ VAT</button>}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => <div key={item._id} className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-600"><p className="font-semibold text-slate-800">{item.legalName}{item.isDefault ? " · Mặc định" : ""}</p><p className="mt-1">MST: {item.taxId}</p><p>{item.address}</p><p>{item.invoiceEmail}</p></div>)}
        {!items.length && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">Chưa có hồ sơ xuất VAT.</p>}
      </div>
      {adding && <form className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4" onSubmit={(event) => { event.preventDefault(); setMessage(""); void customerApi.createBillingProfile(customerId, form, companyCode).then((result) => { setMessage(result.warnings[0]?.message || "Đã thêm hồ sơ VAT."); setForm(empty); setAdding(false); return load(); }).catch((error) => setMessage(error instanceof Error ? error.message : "Không thêm được hồ sơ VAT.")); }}>
        <div className="grid gap-3 sm:grid-cols-2">{(["legalName", "taxId", "address", "invoiceEmail", "contactName"] as const).map((key) => <input key={key} aria-label={key} required={key !== "contactName"} value={form[key] || ""} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} placeholder={({ legalName: "Tên pháp nhân", taxId: "Mã số thuế", address: "Địa chỉ hóa đơn", invoiceEmail: "Email nhận hóa đơn", contactName: "Người liên hệ" } as const)[key]} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100" />)}</div>
        <div className="mt-3 flex justify-end"><button className="rounded-lg bg-[#00ADFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0095d9]">Lưu hồ sơ VAT</button></div>
      </form>}
      {message && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}
    </section>
  );
}
