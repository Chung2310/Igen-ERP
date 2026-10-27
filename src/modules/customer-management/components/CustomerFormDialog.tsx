import React from "react";
import { Save, X } from "lucide-react";
import { VietnameseDatePicker } from "../../student-management/components/Batches/VietnameseDatePicker";
import { RoadmapPicker } from "../../student-management/components/ui/RoadmapPicker";
import type { BillingProfileInput, Customer, CustomerInput } from "../types";

const empty: CustomerInput = { name: "", phone: "", customerKind: "individual", contactName: "", type: "regular", email: "", dateOfBirth: "", address: "", notes: "" };
const emptyBilling: BillingProfileInput = { legalName: "", taxId: "", address: "", invoiceEmail: "", contactName: "" };
const inputClass = "mt-1.5 h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface outline-none transition placeholder:text-on-surface-variant focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export default function CustomerFormDialog({ customer, onClose, onSave }: { customer?: Customer; onClose: () => void; onSave: (input: CustomerInput, billingProfile?: BillingProfileInput) => Promise<void> }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [form, setForm] = React.useState<CustomerInput>({ ...empty, ...customer, customerKind: customer ? customer.customerKind : 'individual', dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "" });
  const [billing, setBilling] = React.useState<BillingProfileInput>(emptyBilling);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const needsBilling = form.type === "vat" && customer?.type !== "vat";

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      returnFocusRef.current?.focus();
    };
  }, []);

  const field = (key: keyof CustomerInput, label: string, type = "text") => (
    <label className="block text-xs font-medium text-on-surface-variant">
      <span>{label}{(key === "name" || key === "phone") && <span className="ml-1 text-error">*</span>}</span>
      <input
        type={type}
        name={key}
        autoComplete={key === "name" ? (form.customerKind === 'business' ? 'organization' : 'name') : key === "phone" ? "tel" : key === "email" ? "email" : "off"}
        required={key === "name" || key === "phone"}
        autoFocus={key === "name"}
        value={String(form[key] || "")}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
        className={inputClass}
      />
    </label>
  );
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="customer-form-title"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        const expandedTrigger = dialogRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]');
        if (!expandedTrigger) return;
        event.preventDefault();
        event.stopPropagation();
        expandedTrigger.click();
        expandedTrigger.focus();
      }}
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center overflow-hidden border-0 bg-transparent px-[max(0.75rem,env(safe-area-inset-left))] py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-on-surface backdrop:bg-black/55 sm:p-5 [--color-on-surface-variant:var(--color-slate-600)]"
    >
      <form onSubmit={(event) => { event.preventDefault(); setSaving(true); setError(""); void onSave(form, needsBilling ? { legalName: billing.legalName.trim(), taxId: billing.taxId.trim(), address: billing.address.trim(), invoiceEmail: billing.invoiceEmail.trim(), contactName: billing.contactName?.trim(), isDefault: true } : undefined).catch((cause) => setError(cause instanceof Error ? cause.message : "Không lưu được khách hàng.")).finally(() => setSaving(false)); }} aria-busy={saving} className="flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-outline-variant px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-primary" aria-hidden="true" />
            <h2 id="customer-form-title" className="text-base font-semibold text-on-surface text-balance">{customer ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng"}</h2>
          </div>
          <button type="button" aria-label="Đóng" disabled={saving} onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-on-surface text-balance">Thông tin cơ bản</h3>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-on-surface-variant">Đối tượng khách hàng<select value={form.customerKind || ''} onChange={(event) => setForm((current) => ({ ...current, customerKind: event.target.value as CustomerInput['customerKind'] }))} className={inputClass}><option value="" disabled>Chưa phân loại</option><option value="individual">Cá nhân</option><option value="business">Doanh nghiệp / tổ chức</option></select></label>
              {field("name", form.customerKind === 'business' ? "Tên doanh nghiệp / tổ chức" : "Họ và tên")}
              {form.customerKind === 'business' && field("contactName", "Người liên hệ")}
              {field("phone", "Số điện thoại", "tel")}
              {field("email", "Email", "email")}
              {form.customerKind !== 'business' && <label className="block text-xs font-medium text-on-surface-variant"><span>Ngày sinh</span><div className="mt-1.5"><VietnameseDatePicker ariaLabel="Ngày sinh" value={form.dateOfBirth} onChange={(dateOfBirth) => setForm((current) => ({ ...current, dateOfBirth }))} selectionOnly portalTarget={() => dialogRef.current} /></div></label>}
              <label className="block text-xs font-medium text-on-surface-variant"><span>Chế độ hóa đơn</span><div className="mt-1.5"><RoadmapPicker value={form.type} onChange={(type) => setForm((current) => ({ ...current, type: type as CustomerInput["type"] }))} placeholder="Chọn chế độ hóa đơn" allowClear={false} options={[{ value: "regular", label: "Khách thường" }, { value: "vat", label: "Khách xuất VAT" }]} /></div></label>
              {field("address", "Địa chỉ")}
            </div>
          </div>
          {needsBilling && <section className="space-y-3 border-t border-outline-variant pt-3" aria-labelledby="customer-vat-form-title">
            <div><h3 id="customer-vat-form-title" className="text-sm font-semibold text-on-surface text-balance">Thông tin xuất VAT</h3><p className="mt-1 text-xs text-on-surface-variant text-pretty">Hồ sơ VAT mặc định được dùng khi lập hóa đơn tại POS.</p></div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {([
                ["legalName", "Tên pháp nhân"], ["taxId", "Mã số thuế"], ["address", "Địa chỉ hóa đơn"], ["invoiceEmail", "Email nhận hóa đơn"], ["contactName", "Người liên hệ"],
              ] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-on-surface-variant">{label}{key !== "contactName" && <span aria-hidden="true"> *</span>}<input required={key !== "contactName"} type={key === "invoiceEmail" ? "email" : "text"} autoComplete={key === "invoiceEmail" ? "email" : "off"} value={billing[key] || ""} onChange={(event) => setBilling((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} /></label>)}
            </div>
          </section>}
          <div className="border-t border-outline-variant pt-3"><h3 className="mb-3 text-sm font-semibold text-on-surface text-balance">Thông tin bổ sung</h3>{field("notes", "Ghi chú")}</div>
          {error && <p role="alert" className="rounded-lg border border-error bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-outline-variant px-5 py-3 sm:px-6">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Hủy</button>
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" aria-hidden="true" />{saving ? "Đang lưu..." : "Lưu khách hàng"}</button>
        </div>
      </form>
    </dialog>
  );
}
