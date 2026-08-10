import React from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { retailSettingsApi } from "../api/retailSettings.api";
import type { RetailSettings } from "../types";

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
      .then(setSettings)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được cài đặt."));
  }, [companyCode, activeBranchId]);

  if (!activeBranchId) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">Vui lòng chọn chi nhánh.</div>;
  if (!settings) return <div className="rounded-2xl border border-slate-200 bg-white p-6">{error || "Đang tải cài đặt bán lẻ..."}</div>;

  const update = <K extends keyof RetailSettings>(key: K, value: RetailSettings[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    setSaving(true); setError("");
    try {
      const { companyCode: _companyCode, branchId: _branchId, ...input } = settings;
      setSettings(await retailSettingsApi.update(input, { companyCode, branchId: activeBranchId }));
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
