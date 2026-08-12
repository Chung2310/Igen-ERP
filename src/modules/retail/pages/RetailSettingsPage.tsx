import React from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { retailSettingsApi } from "../api/retailSettings.api";
import type { RetailSettings } from "../types";

const DEFAULT_CUSTOMER_TIERS = [
  { code: "standard", name: "Thành viên", minSpend: 0 },
  { code: "silver", name: "Bạc", minSpend: 5_000_000 },
  { code: "gold", name: "Vàng", minSpend: 20_000_000 },
  { code: "vip", name: "VIP", minSpend: 50_000_000 },
];
const withCustomerTiers = (value: RetailSettings): RetailSettings => ({ ...value, customerTiers: value.customerTiers || DEFAULT_CUSTOMER_TIERS });

export default function RetailSettingsPage() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const [settings, setSettings] = React.useState<RetailSettings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const companyCode = userProfile?.companyCode || "";

  React.useEffect(() => {
    if (!companyCode || !activeBranchId) return;
    setError("");
    void retailSettingsApi.get({ companyCode, branchId: activeBranchId })
      .then((value) => setSettings(withCustomerTiers(value)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được cài đặt."));
  }, [companyCode, activeBranchId]);

  if (!activeBranchId) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">Vui lòng chọn chi nhánh.</div>;
  if (!settings) return <div className="rounded-2xl border border-slate-200 bg-white p-6">{error || "Đang tải cài đặt bán lẻ..."}</div>;

  const update = <K extends keyof RetailSettings>(key: K, value: RetailSettings[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    setSaving(true); setError("");
    try {
      const { companyCode: _companyCode, branchId: _branchId, ...input } = settings;
      setSettings(withCustomerTiers(await retailSettingsApi.update(input, { companyCode, branchId: activeBranchId })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được cài đặt."); }
    finally { setSaving(false); }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div><h1 className="text-xl font-bold text-slate-900">Cài đặt bán lẻ</h1><p className="text-sm text-slate-500">Áp dụng riêng cho chi nhánh đang chọn.</p></div>
      <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input aria-label="Cho phép bán âm kho" type="checkbox" checked={settings.allowNegativeStock} onChange={(event) => update("allowNegativeStock", event.target.checked)} />Cho phép bán âm kho</label>
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="Giảm giá tối đa (%)" value={settings.maxDiscountPercent} step="0.01" onChange={(value) => update("maxDiscountPercent", value)} />
        <NumberField label="Thuế suất mặc định (%)" value={settings.defaultTaxRate} step="0.01" onChange={(value) => update("defaultTaxRate", value)} />
        <NumberField label="Ngưỡng chênh lệch cần giải trình (VNĐ)" value={settings.varianceReasonThreshold} step="1" onChange={(value) => update("varianceReasonThreshold", value)} />
        <TextField label="Prefix mã đơn" value={settings.orderPrefix} onChange={(value) => update("orderPrefix", value.toUpperCase())} />
        <TextField label="Prefix hóa đơn" value={settings.invoicePrefix} onChange={(value) => update("invoicePrefix", value.toUpperCase())} />
        <SelectField label="Khổ giấy hóa đơn" value={settings.invoicePaperSize} options={[{ value: "A4", label: "A4" }, { value: "A5", label: "A5" }, { value: "80mm", label: "80 mm" }]} onChange={(value) => update("invoicePaperSize", value as RetailSettings["invoicePaperSize"])} />
        <SelectField label="Mẫu hóa đơn" value={settings.invoiceTemplate} options={[{ value: "standard", label: "Tiêu chuẩn" }]} onChange={(value) => update("invoiceTemplate", value as RetailSettings["invoiceTemplate"])} />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div><h2 className="font-bold text-slate-900">Phân hạng khách hàng</h2><p className="text-xs text-slate-500">Hạng được tính theo doanh số thuần sau hoàn tiền.</p></div>
        {settings.customerTiers.map((tier, index) => <div key={tier.code} className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <input aria-label={`Tên hạng ${index + 1}`} className="rounded-xl border border-slate-200 px-3 py-2" value={tier.name} onChange={(event) => update("customerTiers", settings.customerTiers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          <input aria-label={`Ngưỡng hạng ${tier.name}`} type="number" min="0" step="1" disabled={index === 0} className="rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50" value={tier.minSpend} onChange={(event) => update("customerTiers", settings.customerTiers.map((item, itemIndex) => itemIndex === index ? { ...item, minSpend: Number(event.target.value) } : item))} />
        </div>)}
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
    </section>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-slate-700"><span>{label}</span><input aria-label={label} className="w-full rounded-xl border border-slate-200 px-3 py-2" type="number" min="0" max={label.includes("%") ? "100" : undefined} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-slate-700"><span>{label}</span><input aria-label={label} className="w-full rounded-xl border border-slate-200 px-3 py-2 uppercase" maxLength={8} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-slate-700"><span>{label}</span><select aria-label={label} className="w-full rounded-xl border border-slate-200 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
