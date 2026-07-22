import React from "react";

export function ImpersonationDialog({ onStart, onStop }: { onStart: (reason: string, durationMinutes: number) => Promise<void>; onStop: (reason: string) => Promise<void> }) {
  const [reason, setReason] = React.useState("");
  const [active, setActive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const toggle = async () => {
    const writtenReason = reason.trim();
    if (!writtenReason || busy) return;
    setBusy(true);
    try {
      if (active) await onStop(writtenReason);
      else await onStart(writtenReason, 30);
      setActive(!active);
      setReason("");
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
      <label className="mt-3 block text-sm text-slate-300">Lý do đăng nhập thay
        <input aria-label="Lý do đăng nhập thay" required value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white" />
      </label>
      <button type="button" disabled={!reason.trim() || busy} className="mt-3 rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-40" onClick={() => void toggle()}>{busy ? "Đang xử lý…" : active ? "Kết thúc phiên đăng nhập thay" : "Bắt đầu phiên 30 phút"}</button>
    </section>
  );
}
