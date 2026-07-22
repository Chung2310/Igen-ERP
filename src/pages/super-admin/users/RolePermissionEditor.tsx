import React from "react";

type Props = {
  tenantId: string;
  role: string;
  permissions: string[];
  onSave: (role: string, permissions: string[], reason: string) => Promise<void>;
};

export function RolePermissionEditor({ tenantId, role, permissions, onSave }: Props) {
  const [nextRole, setRole] = React.useState(role);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setRole(role); }, [role]);

  return (
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      if (!reason.trim() || saving) return;
      setSaving(true);
      try {
        await onSave(nextRole, permissions, reason.trim());
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
      <label className="block text-sm text-slate-300">Lý do thay đổi quyền
        <input aria-label="Lý do thay đổi quyền" required value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white" />
      </label>
      <button type="submit" disabled={!reason.trim() || saving} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">{saving ? "Đang lưu…" : "Lưu quyền truy cập"}</button>
    </form>
  );
}
