import { getRoleDisplayName } from "../../../utils/permissionUtils";
import React from "react";
import {
  superAdminUserAccessService,
  type PermissionCatalogEntry,
} from "../../../services/superAdminUserAccessService";
import { normalizePermissions } from "../../../../shared/permissions";

type Props = {
  tenantId: string;
  role: string;
  permissions: string[];
  onSave: (role: string, permissions: string[], reason: string) => Promise<void>;
};

export function RolePermissionEditor({ tenantId, role, permissions, onSave }: Props) {
  const [nextRole, setRole] = React.useState(role);
  const [selected, setSelected] = React.useState<string[]>(permissions || []);
  const [catalog, setCatalog] = React.useState<PermissionCatalogEntry[]>([]);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [catalogError, setCatalogError] = React.useState("");

  React.useEffect(() => {
    setRole(role);
  }, [role]);

  // Đồng bộ lại lựa chọn khi đổi sang user khác (adjust-state-during-render)
  const [prevPermissions, setPrevPermissions] = React.useState(permissions);
  if (prevPermissions !== permissions) {
    setPrevPermissions(permissions);
    setSelected(permissions || []);
  }

  React.useEffect(() => {
    setCatalogError("");
    superAdminUserAccessService
      .permissionCatalog()
      .then((r) => setCatalog(r.catalog || []))
      .catch(() => {
        setCatalog([]);
        setCatalogError("Không thể tải danh mục quyền hệ thống. Vui lòng thử lại.");
      });
  }, []);

  const groups = React.useMemo(() => {
    const map = new Map<string, PermissionCatalogEntry[]>();
    for (const entry of catalog) {
      const list = map.get(entry.group) || [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const toggle = (code: string) => setSelected((prev) => {
    const next = prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code];
    return normalizePermissions(next).permissions;
  });

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!reason.trim() || saving) return;
        setSaving(true);
        try {
          await onSave(nextRole, selected, reason.trim());
          setReason("");
        } catch {
          return;
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="block text-sm text-slate-300">
        Vai trò
        <select
          aria-label="Vai trò"
          value={nextRole}
          onChange={(event) => setRole(event.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white"
        >
          <option value="user">{getRoleDisplayName("user")}</option>
          <option value="blog_editor">{getRoleDisplayName("blog_editor")}</option>
          <option value="admin">{getRoleDisplayName("admin")}</option>
        </select>
      </label>

      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">Quyền bổ sung ngoài vai trò</p>
          <p className="text-[11px] text-slate-500">
            Các quyền tick ở đây được cộng thêm vào quyền mặc định của vai trò, không thay thế chúng.
          </p>
          {groups.map(([group, entries]) => (
            <div key={group} className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {entries.map((entry) => (
                  <label
                    key={entry.code}
                    className="flex items-center gap-2 rounded-md border border-white/5 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(entry.code)}
                      onChange={() => toggle(entry.code)}
                      disabled={saving}
                    />
                    <span className="min-w-0 flex-1 truncate" title={entry.code}>
                      {entry.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {catalogError && <p role="status" className="text-sm text-red-400">{catalogError}</p>}

      <label className="block text-sm text-slate-300">
        Lý do thay đổi quyền
        <input
          aria-label="Lý do thay đổi quyền"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={!reason.trim() || saving || !!catalogError}
        className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
      >
        {saving ? "Đang lưu…" : "Lưu quyền truy cập"}
      </button>
    </form>
  );
}
