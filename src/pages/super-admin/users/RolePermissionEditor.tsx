import React from "react";
import { superAdminUserAccessService, type PermissionCatalogEntry } from "../../../services/superAdminUserAccessService";

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
  const [catalogError, setCatalogError] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setRole(role); }, [role]);

  // Đồng bộ lại lựa chọn khi đổi sang user khác (adjust-state-during-render)
  const [prevPermissions, setPrevPermissions] = React.useState(permissions);
  if (prevPermissions !== permissions) {
    setPrevPermissions(permissions);
    setSelected(permissions || []);
  }

  React.useEffect(() => {
    superAdminUserAccessService.permissionCatalog()
      .then((r) => { setCatalog((r.catalog || []).filter((entry) => entry.code !== "*")); setCatalogError(false); })
      .catch(() => { setCatalog([]); setCatalogError(true); });
  }, []);

  const groups = React.useMemo(() => {
    const map = new Map<string, PermissionCatalogEntry[]>();
    for (const entry of catalog) {
      const area = entry.code.split(":")[0];
      const list = map.get(area) || [];
      list.push(entry);
      map.set(area, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const toggle = (area: string, action: "read" | "manage") => setSelected((prev) => {
    const read = `${area}:read`;
    const manage = `${area}:manage`;
    const withoutArea = prev.filter((code) => code !== read && code !== manage && code !== "*");
    if (action === "manage") return prev.includes(manage) ? withoutArea : [...withoutArea, manage];
    if (prev.includes(manage) || prev.includes(read)) return withoutArea;
    return [...withoutArea, read];
  });

  return (
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      if (!reason.trim() || saving) return;
      setSaving(true);
      try {
        const minimal = selected.filter((code) => code !== "*" && !(code.endsWith(":read") && selected.includes(`${code.slice(0, -5)}:manage`)));
        await onSave(nextRole, minimal, reason.trim());
        setReason("");
      } catch {
        return;
      } finally {
        setSaving(false);
      }
    }}>
      <label className="block text-sm text-slate-300">Vai trò
        <select aria-label="Vai trò" value={nextRole} onChange={(event) => setRole(event.target.value)} disabled={saving} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white">
          <option value="user">Người dùng</option>
          <option value="admin">Quản trị viên</option>
        </select>
      </label>

      {catalogError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">Không thể tải danh mục quyền. Vui lòng thử lại sau.</p>}
      {!catalogError && groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">Quyền bổ sung ngoài vai trò</p>
          <p className="text-[11px] text-slate-500">Các quyền tick ở đây được cộng thêm vào quyền mặc định của vai trò, không thay thế chúng.</p>
          {groups.map(([area, entries]) => {
            const group = entries[0]?.group || area;
            const hasManage = selected.includes(`${area}:manage`);
            const hasRead = hasManage || selected.includes(`${area}:read`);
            return (
            <div key={area} className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["read", "manage"] as const).map((action) => (
                  <label key={action} className="flex items-center gap-2 rounded-md border border-white/5 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={action === "read" ? hasRead : hasManage}
                      onChange={() => toggle(area, action)}
                      disabled={saving}
                    />
                    <span>{action === "read" ? "Xem" : "Quản lý"}</span>
                  </label>
                ))}
              </div>
            </div>
          );})}
        </div>
      )}

      <label className="block text-sm text-slate-300">Lý do thay đổi quyền
        <input aria-label="Lý do thay đổi quyền" required value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white" />
      </label>
      <button type="submit" disabled={!reason.trim() || saving} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">{saving ? "Đang lưu…" : "Lưu quyền truy cập"}</button>
    </form>
  );
}
