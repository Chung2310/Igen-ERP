import React from "react";
import { superAdminTenantService, type Tenant, type TenantSummary, type TenantUser } from "../../../services/superAdminTenantService";
import { TenantLifecycleDialog } from "./TenantLifecycleDialog";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "../../../config/modules";
import { getModuleSettings, updateModuleSettings } from "../../../modules/student-management/api/moduleSettings.api";
import { getEntityPresetOptions, type EntityPreset } from "../../../modules/student-management/config/entityLabels";

function EntityPresetEditor({ code, onSaved }: { code: string; onSaved: () => void }) {
  const [preset, setPreset] = React.useState<EntityPreset>("student");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    getModuleSettings(code)
      .then((s) => setPreset(s.entityPreset || "student"))
      .catch(() => setPreset("student"))
      .finally(() => setLoading(false));
  }, [code]);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await updateModuleSettings(preset, code);
      onSaved();
    } catch (e: any) {
      setError(`${e.message || "Lỗi khi cập nhật loại hình doanh nghiệp"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-500">Đang tải loại hình doanh nghiệp...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Chọn loại hình thực thể phù hợp cho doanh nghiệp này (đặc quyền SuperAdmin).
      </p>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as EntityPreset)}
        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400 cursor-pointer font-medium"
      >
        {getEntityPresetOptions(preset).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <button disabled={saving} onClick={save} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
        {saving ? "Đang lưu..." : "Lưu loại hình doanh nghiệp"}
      </button>
    </div>
  );
}

function ModulesEditor({ code, current, onSaved }: { code: string; current: string[]; onSaved: () => void }) {
  const [selected, setSelected] = React.useState<ModuleKey[]>((current as ModuleKey[]) || [...MODULE_KEYS]);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setSelected((current as ModuleKey[]) || [...MODULE_KEYS]); }, [current]);

  const toggle = (key: ModuleKey) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const save = async () => {
    setError(""); setSaving(true);
    try {
      await superAdminTenantService.updateModules(code, { enabledModules: selected, reason });
      setReason("");
      onSaved();
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {MODULE_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs">
            <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} />
            {MODULE_LABELS[key]}
          </label>
        ))}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do thay đổi" className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-400" />
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <button disabled={!reason.trim() || saving} onClick={save} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
        {saving ? "Đang lưu..." : "Lưu module"}
      </button>
    </div>
  );
}

function StatusToggle({ code, current, onSaved }: { code: string; current?: string; onSaved: () => void }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const setStatus = async (lifecycleStatus: "active" | "suspended") => {
    setError(""); setSaving(true);
    try {
      await superAdminTenantService.transition(code, { lifecycleStatus, reason });
      setReason("");
      onSaved();
    } catch (e: any) {
      setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`);
    } finally { setSaving(false); }
  };

  const isActive = current === "active";

  return (
    <div className="space-y-3">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do thay đổi trạng thái" className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-400" />
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <div className="flex gap-2">
        <button disabled={isActive || !reason.trim() || saving} onClick={() => setStatus("active")} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
          Kích hoạt
        </button>
        <button disabled={!isActive || !reason.trim() || saving} onClick={() => setStatus("suspended")} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
          Vô hiệu hoá
        </button>
      </div>
    </div>
  );
}

export function TenantDetailPage({ code, onBack }: { code: string; onBack?: () => void }) {
  const [tenant, setTenant] = React.useState<Tenant>();
  const [summary, setSummary] = React.useState<TenantSummary>();
  const [audit, setAudit] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<TenantUser[]>([]);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    Promise.all([superAdminTenantService.detail(code), superAdminTenantService.listUsers(code)])
      .then(([d, u]) => { setTenant(d.tenant); setSummary(d.summary); setAudit(d.audit || []); setUsers(u); })
      .catch((e: any) => setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`));
  }, [code]);

  React.useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-cyan-300">
          ← Quay lại danh sách
        </button>
      )}
      <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>
    </div>
  );
  if (!tenant) return <p className="text-slate-400">Đang tải thông tin doanh nghiệp…</p>;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 text-slate-100">
      <header className="border-b border-white/10 pb-5">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
          >
            ← Quay lại danh sách
          </button>
        )}
        <h2 className="text-2xl font-bold">{tenant.name}</h2>
        <p className="mt-1 font-mono text-xs text-slate-500">{tenant.code} · {tenant.ownerEmail}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{tenant.lifecycleStatus}</span>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Số liệu tổng quan</h3>
        {summary ? (
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Tổng người dùng</dt><dd className="text-lg font-bold">{summary.userCount}</dd></div>
            <div><dt className="text-xs text-slate-500">Module đang bật</dt><dd className="text-lg font-bold">{summary.enabledModulesCount}</dd></div>
            <div><dt className="text-xs text-slate-500">Theo vai trò</dt><dd className="text-xs">{Object.entries(summary.usersByRole).map(([role, count]) => `${role}: ${count}`).join(", ") || "—"}</dd></div>
          </dl>
        ) : <p className="mt-2 text-xs text-slate-500">Đang tải…</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Trạng thái hoạt động</h3>
        <div className="mt-3"><StatusToggle code={code} current={tenant.lifecycleStatus} onSaved={load} /></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Loại hình doanh nghiệp / Nhãn thực thể</h3>
        <div className="mt-3"><EntityPresetEditor code={code} onSaved={load} /></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Module</h3>
        <div className="mt-3"><ModulesEditor code={code} current={tenant.enabledModules || []} onSaved={load} /></div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Tài khoản quản trị công ty</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="pb-2 pr-4">Tên</th><th className="pb-2 pr-4">Email</th><th className="pb-2 pr-4">Vai trò</th><th className="pb-2 pr-4">Trạng thái</th><th className="pb-2 pr-4">Tài khoản</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="py-2 pr-4">{u.displayName}</td>
                  <td className="py-2 pr-4 font-mono">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4">{u.status}</td>
                  <td className="py-2 pr-4">
                    {u.disabledAt
                      ? <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">Đã vô hiệu hoá</span>
                      : <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Active</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="py-4 text-center text-slate-500">Chưa có tài khoản nào.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Nhật ký kiểm toán gần đây</h3>
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {audit.map((a: any) => <li key={a.eventId}>{a.actionType}</li>)}
          {audit.length === 0 && <li className="text-slate-500">Không có sự kiện gần đây.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-bold text-slate-200">Vòng đời</h3>
        <div className="mt-3"><TenantLifecycleDialog code={code} onDone={load} /></div>
      </div>
    </section>
  );
}
