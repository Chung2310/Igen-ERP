import React from "react";
import { X } from "lucide-react";
import { customerApi } from "../../../customer-management/customerApi";
import type { RetailCustomer, RetailScope } from "../../types";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

type CustomerForm = {
  type: "regular" | "vat";
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type VatForm = {
  legalName: string;
  taxId: string;
  address: string;
  invoiceEmail: string;
  contactName: string;
};

type Props = {
  scope: RetailScope;
  initialPhone: string;
  onClose: () => void;
  onCreated: (customer: RetailCustomer) => void;
};

const labels: Record<Exclude<keyof CustomerForm, "type">, string> = {
  name: "Tên khách hàng",
  phone: "Số điện thoại",
  email: "Email",
  address: "Địa chỉ",
  notes: "Ghi chú",
};

const vatLabels: Record<keyof VatForm, string> = {
  legalName: "Tên pháp nhân",
  taxId: "Mã số thuế",
  address: "Địa chỉ hóa đơn",
  invoiceEmail: "Email nhận hóa đơn",
  contactName: "Người liên hệ",
};

export default function CreateCustomerDialog({ scope, initialPhone, onClose, onCreated }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [form, setForm] = React.useState<CustomerForm>({
    name: "",
    phone: initialPhone.trim(),
    email: "",
    address: "",
    notes: "",
    type: "regular",
  });
  const [vatForm, setVatForm] = React.useState<VatForm>({
    legalName: "",
    taxId: "",
    address: "",
    invoiceEmail: "",
    contactName: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [createdCustomer, setCreatedCustomer] = React.useState<Awaited<ReturnType<typeof customerApi.create>> | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    returnFocusRef.current = previousFocus instanceof HTMLElement ? previousFocus : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      returnFocusRef.current?.focus();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value?.trim() || ""]),
    ) as CustomerForm;
    const normalizedVat = Object.fromEntries(
      Object.entries(vatForm).map(([key, value]) => [key, value?.trim() || ""]),
    ) as VatForm;
    if (!input.name) {
      setError("Vui lòng nhập tên khách hàng.");
      return;
    }
    if (!input.phone) {
      setError("Vui lòng nhập số điện thoại khách hàng.");
      return;
    }
    if (input.type === "vat" && (!normalizedVat.legalName || !normalizedVat.taxId || !normalizedVat.address || !normalizedVat.invoiceEmail)) {
      setError("Vui lòng nhập đầy đủ thông tin xuất VAT.");
      return;
    }
    setSaving(true);
    setError("");
    let created = createdCustomer;
    try {
      if (!created) {
        created = await customerApi.create({ ...input, source: "pos" }, scope.companyCode);
        setCreatedCustomer(created);
      }
      if (input.type === "vat") {
        await customerApi.createBillingProfile(created._id, {
          legalName: normalizedVat.legalName,
          taxId: normalizedVat.taxId,
          address: normalizedVat.address,
          invoiceEmail: normalizedVat.invoiceEmail,
          ...(normalizedVat.contactName ? { contactName: normalizedVat.contactName } : {}),
          isDefault: true,
        }, scope.companyCode);
      }
      onCreated({ _id: created._id, customerCode: created.customerCode, companyCode: created.companyCode, type: created.type, name: created.name, phone: created.phone, email: created.email, address: created.address, notes: created.notes });
    } catch (cause) {
      const message = getApiErrorMessage(cause, "Không tạo được khách hàng.");
      setError(created && input.type === "vat" ? `Đã tạo khách hàng nhưng chưa lưu được hồ sơ VAT: ${message} Bạn có thể thử lưu lại.` : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-label="Tạo khách hàng mới" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent px-[max(0.75rem,env(safe-area-inset-left))] py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-on-surface backdrop:bg-black/55 open:flex sm:p-4">
      <form
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-lg sm:p-6"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Tạo khách hàng mới</h2>
            <p className="text-sm text-on-surface-variant text-pretty">Khách hàng sẽ được chọn vào đơn hiện tại sau khi lưu.</p>
          </div>
          <button type="button" aria-label="Đóng" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <label className="block text-sm font-semibold">
          <span>Loại khách hàng</span>
          <select
            aria-label="Loại khách hàng"
            disabled={Boolean(createdCustomer)}
            value={form.type}
            onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as "regular" | "vat" }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
          >
            <option value="regular">Khách thường</option>
            <option value="vat">Khách xuất VAT</option>
          </select>
        </label>
        {(["name", "phone", "email", "address", "notes"] as Array<Exclude<keyof CustomerForm, "type">>).map((key) => (
          <label key={key} className="block text-sm font-semibold">
            <span>{labels[key]}{key === "name" ? " *" : ""}</span>
            <input
              aria-label={labels[key]}
              aria-required={key === "name" || key === "phone"}
              disabled={Boolean(createdCustomer)}
              autoFocus={key === "name"}
              value={form[key] || ""}
              onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
            />
          </label>
        ))}
        {form.type === "vat" && (
          <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
            <div>
              <h3 className="text-sm font-semibold text-on-surface text-balance">Thông tin xuất VAT</h3>
              <p className="text-xs text-on-surface-variant text-pretty">Hồ sơ VAT mặc định sẽ được tạo cùng khách hàng.</p>
            </div>
            {(["legalName", "taxId", "address", "invoiceEmail", "contactName"] as Array<keyof VatForm>).map((key) => (
              <label key={key} className="block text-sm font-semibold">
                <span>{vatLabels[key]}{key !== "contactName" ? " *" : ""}</span>
                <input
                  aria-label={vatLabels[key]}
                  aria-required={key !== "contactName"}
                  aria-invalid={Boolean(error && createdCustomer)}
                  aria-describedby={error && createdCustomer ? "retail-create-customer-error" : undefined}
                  value={vatForm[key]}
                  onChange={(event) => setVatForm((value) => ({ ...value, [key]: event.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                />
              </label>
            ))}
          </div>
        )}
        {error && <p id="retail-create-customer-error" role="alert" className="rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" disabled={saving} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2.5 font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={onClose}>
            Hủy
          </button>
          <button disabled={saving} className="min-h-11 rounded-xl bg-primary px-4 py-2.5 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
            {saving ? "Đang lưu..." : createdCustomer ? "Lưu hồ sơ VAT" : "Lưu khách hàng"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
