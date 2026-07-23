import React from "react";
import { superAdminUserAccessService } from "../../../services/superAdminUserAccessService";

export function ImpersonationDialog({ tenantId, userId, onStart, onStop }: { tenantId: string; userId: string; onStart: (reason: string, durationMinutes: number) => Promise<void>; onStop: (reason: string) => Promise<void> }) {
  const [reason, setReason] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    superAdminUserAccessService.activeImpersonation(tenantId, userId)
      .then((r) => setExpiresAt(r.active?.expiresAt || null))
      .catch(() => setExpiresAt(null));
  }, [tenantId, userId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  // Đồng hồ 1s cho đếm ngược; remaining/active suy ra từ expiresAt của server
  React.useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const active = remainingMs > 0;
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const remaining = active ? `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}` : "";

  const toggle = async () => {
    const writtenReason = reason.trim();
    if (!writtenReason || busy) return;
    setBusy(true);
    try {
      if (active) await onStop(writtenReason);
      else await onStart(writtenReason, 30);
      setReason("");
      refresh();
    } catch {
      return;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-amber-400/30 p-4">
      <h4 className="font-bold">Đăng nhập thay người dùng có kiểm soát</h4>
      <p className="mt-1 text-sm text-slate-400">Tối đa 30 phút. Các chức năng khôi phục, bí mật, quản trị Super Admin và sửa nhật ký bị chặn.</p>
      {active && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">
          Đang có phiên đăng nhập thay hoạt động{remaining ? ` · còn ${remaining}` : ""}.
        </p>
      )}
      <label className="mt-3 block text-sm text-slate-300">Lý do {active ? "kết thúc" : "đăng nhập thay"}
        <input aria-label="Lý do đăng nhập thay" required value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white" />
      </label>
      <button type="button" disabled={!reason.trim() || busy} className="mt-3 rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40" onClick={() => void toggle()}>{busy ? "Đang xử lý…" : active ? "Kết thúc phiên đăng nhập thay" : "Bắt đầu phiên 30 phút"}</button>
    </section>
  );
}
