import React from "react";
import { ShieldAlert, X } from "lucide-react";
import { superAdminUserAccessService, type SuperAdminUser } from "../../../services/superAdminUserAccessService";
import { ImpersonationDialog } from "./ImpersonationDialog";
import { RolePermissionEditor } from "./RolePermissionEditor";
import { UserActivityTimeline } from "./UserActivityTimeline";

type Props = {
  tenantId: string;
  userId: string;
  onClose: () => void;
};

const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : "Không thể thực hiện thao tác.";

export function UserDetailDialog({ tenantId, userId, onClose }: Props) {
  const [user, setUser] = React.useState<SuperAdminUser>();
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUser(await superAdminUserAccessService.detail(tenantId, userId));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const run = async (operation: () => Promise<unknown>, successMessage: string, refresh = true, propagateError = false) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await operation();
      setSuccess(successMessage);
      setReason("");
      if (refresh) await load();
    } catch (cause) {
      setError(messageOf(cause));
      if (propagateError) throw cause;
    } finally {
      setBusy(false);
    }
  };

  const securityAction = (operation: (input: { reason: string }) => Promise<unknown>, successMessage: string) => {
    const writtenReason = reason.trim();
    if (!writtenReason || busy) return;
    void run(() => operation({ reason: writtenReason }), successMessage);
  };

  const isLocked = Boolean(user?.lockedAt) || user?.status === "locked";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="user-detail-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Quản trị tài khoản</p>
            <h3 id="user-detail-dialog-title" className="mt-1 text-xl font-bold">{user?.displayName || user?.email || "Chi tiết người dùng"}</h3>
            {user && <p className="mt-1 text-sm text-slate-400">{user.email}</p>}
          </div>
          <button type="button" aria-label="Đóng popup" onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>

        {loading && !user ? <p className="py-10 text-center text-sm text-slate-400">Đang tải thông tin người dùng…</p> : null}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p>}

        {user && (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500">Vai trò</dt><dd className="mt-1 font-semibold">{user.role}</dd></div>
              <div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold">{isLocked ? "Đã khóa" : user.status || "Đang hoạt động"}</dd></div>
              <div><dt className="text-xs text-slate-500">Mã người dùng</dt><dd className="mt-1 truncate font-mono text-xs">{user._id}</dd></div>
              <div className="sm:col-span-3"><dt className="text-xs text-slate-500">Quyền hiện tại</dt><dd className="mt-1 text-sm">{user.permissions?.join(", ") || "Chưa có quyền riêng"}</dd></div>
            </dl>

            <section className="rounded-xl border border-white/10 p-4">
              <h4 className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4 text-amber-300" />Bảo mật tài khoản</h4>
              <label className="mt-3 block text-xs font-semibold text-slate-400">Lý do thao tác bảo mật<input aria-label="Lý do thao tác bảo mật" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-40" /></label>
              <div className="mt-3 flex flex-wrap gap-2">
                {isLocked ? (
                  <button type="button" disabled={!reason.trim() || busy} onClick={() => securityAction((input) => superAdminUserAccessService.unlock(tenantId, userId, input), "Đã mở khóa tài khoản.")} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Mở khóa tài khoản</button>
                ) : (
                  <button type="button" disabled={!reason.trim() || busy} onClick={() => securityAction((input) => superAdminUserAccessService.lock(tenantId, userId, input), "Đã khóa tài khoản.")} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Khóa tài khoản</button>
                )}
                <button type="button" disabled={!reason.trim() || busy} onClick={() => securityAction((input) => superAdminUserAccessService.revokeSessions(tenantId, userId, input), "Đã thu hồi toàn bộ phiên đăng nhập.")} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Thu hồi phiên đăng nhập</button>
                <button type="button" disabled={!reason.trim() || busy} onClick={() => { const writtenReason = reason.trim(); if (writtenReason) void run(() => superAdminUserAccessService.resetTwoFactor(tenantId, userId, writtenReason), "Đã đặt lại xác thực hai bước."); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold disabled:opacity-40">Đặt lại xác thực hai bước</button>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 p-4">
              <h4 className="mb-3 font-bold">Vai trò và quyền truy cập</h4>
              {user.role === "superadmin" ? (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">Role Super Admin duy nhất được hệ thống bảo vệ và không thể thay đổi.</p>
              ) : (
                <RolePermissionEditor tenantId={tenantId} role={user.role} permissions={user.permissions || []} onSave={(role, permissions, editReason) => run(() => superAdminUserAccessService.assignRole(tenantId, userId, role, permissions, { reason: editReason }), "Đã cập nhật vai trò và quyền.", true, true).then(() => undefined)} />
              )}
            </section>
            <UserActivityTimeline tenantId={tenantId} userId={userId} />
            <ImpersonationDialog onStart={(impersonationReason, durationMinutes) => run(() => superAdminUserAccessService.startImpersonation(tenantId, userId, { reason: impersonationReason, durationMinutes }), "Đã bắt đầu phiên đăng nhập thay người dùng.", false, true).then(() => undefined)} onStop={(impersonationReason) => run(() => superAdminUserAccessService.stopImpersonation(tenantId, userId, { reason: impersonationReason }), "Đã kết thúc phiên đăng nhập thay người dùng.", false, true).then(() => undefined)} />
          </div>
        )}
      </section>
    </div>
  );
}
