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
    if (input.type === "vat" && (!normalizedVat.legalName || !normalizedVat.taxId || !normalizedVat.address || !normalizedVat.invoiceEmail)) {
      setError("Vui lòng nhập đầy đủ thông tin xuất VAT.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await customerApi.create(input, scope.companyCode);
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
      setError(getApiErrorMessage(cause, "Không tạo được khách hàng."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        role="dialog"
        aria-label="Tạo khách hàng mới"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Tạo khách hàng mới</h2>
            <p className="text-sm text-slate-500">Khách hàng sẽ được chọn vào đơn hiện tại sau khi lưu.</p>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="block text-sm font-semibold">
          <span>Loại khách hàng</span>
          <select
            aria-label="Loại khách hàng"
            value={form.type}
            onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as "regular" | "vat" }))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
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
              autoFocus={key === "name"}
              value={form[key] || ""}
              onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        ))}
        {form.type === "vat" && (
          <div className="space-y-4 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Thông tin xuất VAT</h3>
              <p className="text-xs text-slate-500">Hồ sơ VAT mặc định sẽ được tạo cùng khách hàng.</p>
            </div>
            {(["legalName", "taxId", "address", "invoiceEmail", "contactName"] as Array<keyof VatForm>).map((key) => (
              <label key={key} className="block text-sm font-semibold">
                <span>{vatLabels[key]}{key !== "contactName" ? " *" : ""}</span>
                <input
                  aria-label={vatLabels[key]}
                  value={vatForm[key]}
                  onChange={(event) => setVatForm((value) => ({ ...value, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
            ))}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" className="rounded-xl border px-4 py-2.5 font-semibold" onClick={onClose}>
            Hủy
          </button>
          <button disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
            {saving ? "Đang lưu..." : "Lưu khách hàng"}
          </button>
        </div>
      </form>
    </div>
  );
}
