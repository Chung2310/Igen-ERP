import React from "react";
import { X } from "lucide-react";
import { superAdminTenantService } from "../../../services/superAdminTenantService";
import { DEFAULT_MODULE_KEYS, MODULE_OPTIONS, type ModuleKey } from "../../../config/modules";

export function TenantCreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [enabledModules, setEnabledModules] = React.useState<ModuleKey[]>(DEFAULT_MODULE_KEYS);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
    return () => { dialog?.close?.(); previousFocus?.focus(); };
  }, []);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const toggleModule = (moduleKeys: readonly ModuleKey[]) => {
    setEnabledModules((prev) => moduleKeys.every((key) => prev.includes(key))
      ? prev.filter((key) => !moduleKeys.includes(key))
      : [...new Set([...prev, ...moduleKeys])]);
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
      });
      onCreated(code.trim().toUpperCase());
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = code.trim() && name.trim() && ownerName.trim() && ownerEmail.trim() && ownerPassword.length >= 6 && enabledModules.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <dialog ref={dialogRef} aria-labelledby="tenant-create-title" onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }} className="m-auto w-full max-w-lg rounded-2xl border border-outline-variant bg-surface p-6 text-on-surface shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between border-b border-outline-variant pb-4">
          <h3 id="tenant-create-title" className="text-balance text-lg font-bold">Tạo doanh nghiệp mới</h3>
          <button aria-label="Đóng" disabled={submitting} onClick={onClose} className="text-on-surface/70 hover:text-on-surface"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-on-surface/70">
              Mã doanh nghiệp
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACME" className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-xs font-semibold text-on-surface/70">
              Tên doanh nghiệp
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Công ty ACME" className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-on-surface/70">
              Tên admin
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-xs font-semibold text-on-surface/70">
              Email admin
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="admin@acme.com" className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-on-surface/70">
            Mật khẩu admin (tối thiểu 6 ký tự)
            <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <div>
            <span className="block text-xs font-semibold text-on-surface/70">Module kích hoạt</span>
            {enabledModules.length === 0 && <p role="status" className="mt-2 text-sm text-on-surface/70">Chọn ít nhất một module để tạo doanh nghiệp.</p>}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODULE_OPTIONS.map((option) => (
                <label key={option.key} className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs">
                  <input type="checkbox" checked={option.moduleKeys.some((key) => enabledModules.includes(key))} onChange={() => toggleModule(option.moduleKeys)} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container">Huỷ</button>
          <button disabled={!canSubmit || submitting} onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-40">
            {submitting ? "Đang tạo..." : "Tạo doanh nghiệp"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
