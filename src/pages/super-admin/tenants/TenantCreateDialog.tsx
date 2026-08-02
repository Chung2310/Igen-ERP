import React from "react";
import { X } from "lucide-react";
import { superAdminTenantService } from "../../../services/superAdminTenantService";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "../../../config/modules";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, getRequiredBusinessModule, isModuleAllowedForBusinessType, type BusinessType } from "../../../config/businessTypes";

export function TenantCreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [enabledModules, setEnabledModules] = React.useState<ModuleKey[]>(MODULE_KEYS.filter((key) => isModuleAllowedForBusinessType(key, "education")));
  const [businessType, setBusinessType] = React.useState<BusinessType>("education");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const toggleModule = (key: ModuleKey) => {
    if (key === getRequiredBusinessModule(businessType)) return;
    setEnabledModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const changeBusinessType = (nextType: BusinessType) => {
    const allowed = enabledModules.filter((key) => isModuleAllowedForBusinessType(key, nextType));
    const required = getRequiredBusinessModule(nextType);
    setBusinessType(nextType);
    setEnabledModules(required && !allowed.includes(required) ? [required, ...allowed] : allowed);
  };

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await superAdminTenantService.create({
        code: code.trim(),
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim(),
        ownerPassword,
        enabledModules,
        businessType,
      });
      onCreated(code.trim().toUpperCase());
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = code.trim() && name.trim() && ownerName.trim() && ownerEmail.trim() && ownerPassword.length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold">Tạo doanh nghiệp mới</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-400">
              Mã doanh nghiệp
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACME" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-400">
              Tên doanh nghiệp
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Công ty ACME" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-400">
              Tên admin
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-400">
              Email admin
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="admin@acme.com" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-400">
            Mật khẩu admin (tối thiểu 6 ký tự)
            <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400" />
          </label>
          <div>
            <label className="block text-xs font-semibold text-slate-400">
              Loại hình doanh nghiệp / Nhãn thực thể
              <select
                value={businessType}
                onChange={(e) => changeBusinessType(e.target.value as BusinessType)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-400 text-slate-100 cursor-pointer"
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-400">Module kích hoạt</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MODULE_KEYS.filter((key) => isModuleAllowedForBusinessType(key, businessType)).map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs">
                  <input type="checkbox" checked={enabledModules.includes(key)} onChange={() => toggleModule(key)} disabled={key === getRequiredBusinessModule(businessType)} />
                  {MODULE_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Huỷ</button>
          <button disabled={!canSubmit || submitting} onClick={submit} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
            {submitting ? "Đang tạo..." : "Tạo doanh nghiệp"}
          </button>
        </div>
      </div>
    </div>
  );
}
