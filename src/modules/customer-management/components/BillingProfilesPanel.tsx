import React from "react";
import { Plus } from "lucide-react";
import { customerApi } from "../customerApi";
import type { BillingProfileInput } from "../types";

const empty: BillingProfileInput = { legalName: "", taxId: "", address: "", invoiceEmail: "", contactName: "" };

export default function BillingProfilesPanel({ customerId, companyCode, canManage, onProfileCreated }: { customerId: string; companyCode: string; canManage: boolean; onProfileCreated?: () => Promise<void> }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState(empty);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(() => customerApi.billingProfiles(customerId, companyCode), [customerId, companyCode]);
  React.useEffect(() => {
    let active = true;
    void load().then((value) => { if (active) setItems(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ VAT."); });
    return () => { active = false; };
  }, [load]);
  const labels = { legalName: "Tên pháp nhân", taxId: "Mã số thuế", address: "Địa chỉ hóa đơn", invoiceEmail: "Email nhận hóa đơn", contactName: "Người liên hệ" } as const;
  return (
    <section className="space-y-4" aria-labelledby="customer-billing-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 id="customer-billing-title" className="text-base font-semibold text-on-surface text-balance">Hồ sơ xuất VAT</h3><p className="mt-1 text-sm text-on-surface-variant text-pretty">Thông tin pháp nhân dùng để xuất hóa đơn cho khách hàng.</p></div>
        {canManage && <button type="button" aria-expanded={adding} aria-controls={adding ? "customer-billing-profile-form" : undefined} onClick={() => { setAdding((value) => !value); setError(""); setMessage(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" />{adding ? "Đóng biểu mẫu" : "Thêm hồ sơ VAT"}</button>}
      </div>
      {error && <p id="customer-billing-error" role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">{message}</p>}
      <div className="space-y-3">
        {items.map((item) => <article key={item._id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-semibold text-on-surface">{item.legalName}</h4>{item.isDefault && <span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary-container">Mặc định</span>}</div>
          <dl className="mt-3 grid gap-2 text-on-surface-variant sm:grid-cols-2"><div><dt className="text-xs">Mã số thuế</dt><dd className="mt-1 font-medium text-on-surface">{item.taxId}</dd></div><div><dt className="text-xs">Email hóa đơn</dt><dd className="mt-1 break-words font-medium text-on-surface">{item.invoiceEmail}</dd></div><div className="sm:col-span-2"><dt className="text-xs">Địa chỉ hóa đơn</dt><dd className="mt-1 break-words font-medium text-on-surface">{item.address}</dd></div>{item.contactName && <div><dt className="text-xs">Người liên hệ</dt><dd className="mt-1 font-medium text-on-surface">{item.contactName}</dd></div>}</dl>
        </article>)}
        {!items.length && <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">Chưa có hồ sơ xuất VAT. {canManage ? "Thêm hồ sơ để chọn khi lập hóa đơn." : ""}</p>}
      </div>
      {adding && <form id="customer-billing-profile-form" className="rounded-xl border border-outline-variant bg-surface-container-low p-4" onSubmit={(event) => {
        event.preventDefault(); setBusy(true); setError(""); setMessage("");
        void (async () => {
          try {
            const result = await customerApi.createBillingProfile(customerId, form, companyCode);
            setMessage(result.warnings[0]?.message || "Đã thêm hồ sơ VAT.");
            setForm(empty); setAdding(false);
            try { setItems(await load()); await onProfileCreated?.(); }
            catch (cause) { setError(cause instanceof Error ? `Đã thêm hồ sơ VAT nhưng chưa tải lại được: ${cause.message}` : "Đã thêm hồ sơ VAT nhưng chưa tải lại được."); }
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thêm được hồ sơ VAT."); }
          finally { setBusy(false); }
        })();
      }}>
        <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <label key={key} className="text-sm font-medium text-on-surface">{labels[key]}{key !== "contactName" && <span aria-hidden="true"> *</span>}<input required={key !== "contactName"} maxLength={key === "address" ? 300 : 160} type={key === "invoiceEmail" ? "email" : "text"} autoComplete={key === "invoiceEmail" ? "email" : "off"} value={form[key] || ""} aria-invalid={Boolean(error)} aria-describedby={error ? "customer-billing-error" : undefined} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>)}</div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary">Hủy</button><button disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu hồ sơ VAT"}</button></div>
      </form>}
    </section>
  );
}
