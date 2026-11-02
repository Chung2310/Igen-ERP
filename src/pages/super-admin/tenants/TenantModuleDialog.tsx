import React from "react";
import { X } from "lucide-react";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS, MODULE_OPTIONS, type ModuleKey } from "../../../config/modules";
import { superAdminTenantService, type Tenant, type TenantSummary } from "../../../services/superAdminTenantService";

type Props = {
  code: string;
  onClose: () => void;
  onSaved: () => void;
};

export function TenantModuleDialog({ code, onClose, onSaved }: Props) {
  const [tenant, setTenant] = React.useState<Tenant>();
  const [summary, setSummary] = React.useState<TenantSummary>();
  const [selected, setSelected] = React.useState<ModuleKey[]>([]);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
    return () => { dialog?.close?.(); previousFocus?.focus(); };
  }, []);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusReason, setStatusReason] = React.useState("");
  const [statusError, setStatusError] = React.useState("");
  const [statusSaving, setStatusSaving] = React.useState(false);

  const loadTenant = React.useCallback((active: { current: boolean } = { current: true }) => {
    setLoading(true);
    setError("");
    return superAdminTenantService.detail(code)
      .then((result) => {
        if (!active.current) return;
        setTenant(result.tenant);
        setSummary(result.summary);
        const modules = Array.isArray(result.tenant.enabledModules)
          ? result.tenant.enabledModules.filter((key): key is ModuleKey => MODULE_KEYS.includes(key as ModuleKey))
          : [...DEFAULT_MODULE_KEYS];
        setSelected(modules);
      })
      .catch((cause: any) => {
        if (active.current) setError(`${cause.message}${cause.correlationId ? ` (${cause.correlationId})` : ""}`);
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
  }, [code]);

  React.useEffect(() => {
    const active = { current: true };
    loadTenant(active);
    return () => { active.current = false; };
  }, [loadTenant]);

  const toggleModule = (moduleKeys: readonly ModuleKey[]) => {
    setSelected((current) => moduleKeys.every((key) => current.includes(key))
      ? current.filter((item) => !moduleKeys.includes(item))
      : [...new Set([...current, ...moduleKeys])]);
  };

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        superAdminTenantService.updateModules(code, {
          enabledModules: selected,
          reason: "Cập nhật cấu hình module",
        }),
      ]);
      onSaved();
    } catch (cause: any) {
      setError(`${cause.message}${cause.correlationId ? ` (${cause.correlationId})` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !loading && selected.length > 0 && !saving;

  const setLifecycleStatus = async (lifecycleStatus: "active" | "suspended") => {
    if (!statusReason.trim()) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await superAdminTenantService.transition(code, { lifecycleStatus, reason: statusReason.trim() });
      setStatusReason("");
      await loadTenant();
    } catch (cause: any) {
      setStatusError(`${cause.message}${cause.correlationId ? ` (${cause.correlationId})` : ""}`);
    } finally {
      setStatusSaving(false);
    }
  };

  const isActive = tenant?.lifecycleStatus === "active";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <dialog
        ref={dialogRef}
        onCancel={(event) => { event.preventDefault(); if (!saving && !statusSaving) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-module-dialog-title"
        className="m-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface p-5 text-on-surface shadow-2xl sm:p-6"
      >
        <header className="flex items-center justify-between border-b border-outline-variant pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Quản lý doanh nghiệp</p>
            <h3 id="tenant-module-dialog-title" className="mt-1 text-balance text-lg font-bold">Thông tin và module</h3>
          </div>
          <button type="button" aria-label="Đóng popup" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-on-surface/70 hover:bg-surface-container hover:text-on-surface disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <p className="py-10 text-center text-sm text-on-surface/70">Đang tải thông tin doanh nghiệp…</p>
        ) : tenant ? (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2">
              <div><dt className="text-xs text-on-surface/70">Tên doanh nghiệp</dt><dd className="mt-1 font-semibold">{tenant.name || "—"}</dd></div>
              <div><dt className="text-xs text-on-surface/70">Mã doanh nghiệp</dt><dd className="mt-1 font-mono text-sm">{tenant.code}</dd></div>
              <div><dt className="text-xs text-on-surface/70">Email chủ sở hữu</dt><dd className="mt-1 text-sm">{tenant.ownerEmail || "—"}</dd></div>
              <div><dt className="text-xs text-on-surface/70">Trạng thái</dt><dd className="mt-1 text-sm">{tenant.lifecycleStatus || "—"}</dd></div>
              <div><dt className="text-xs text-on-surface/70">Số người dùng</dt><dd className="mt-1 font-semibold">{summary?.userCount ?? "—"}</dd></div>
            </dl>

            <div>
              <h4 className="text-sm font-bold">Module được kích hoạt</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MODULE_OPTIONS.map((option) => (
                  <label key={option.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-3 py-3 text-sm hover:border-primary/40">
                    <input type="checkbox" checked={option.moduleKeys.some((key) => selected.includes(key))} onChange={() => toggleModule(option.moduleKeys)} disabled={saving} />
                    {option.label}
                  </label>
                ))}
              </div>
              {selected.length === 0 && <p className="mt-2 text-xs text-amber-300">Doanh nghiệp phải có ít nhất một module.</p>}
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <h4 className="text-sm font-bold">Trạng thái hoạt động</h4>
              <p className="mt-1 text-xs text-on-surface/70">Vô hiệu hoá sẽ khoá đăng nhập của toàn bộ nhân viên trong doanh nghiệp này.</p>
              <label className="mt-3 block text-xs font-semibold text-on-surface/70">Lý do đổi trạng thái<input aria-label="Lý do đổi trạng thái" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" /></label>
              {statusError && <p role="alert" className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{statusError}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setLifecycleStatus("active")} disabled={isActive || !statusReason.trim() || statusSaving} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-40">Kích hoạt</button>
                <button type="button" onClick={() => setLifecycleStatus("suspended")} disabled={!isActive || !statusReason.trim() || statusSaving} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-40">Vô hiệu hoá</button>
              </div>
            </div>
          </div>
        ) : null}

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}

        <footer className="mt-5 flex justify-end gap-2 border-t border-outline-variant pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-40">Hủy</button>
          <button type="button" onClick={save} disabled={!canSave} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-40">
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </footer>
      </dialog>
    </div>
  );
}
