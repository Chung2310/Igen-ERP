import { useState } from "react";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailScope, RetailShift } from "../types";

export function RetailShiftSessionPanel({ scope, shift, onSaved }: { scope: RetailScope; shift: RetailShift; onSaved: (shift: RetailShift) => void }) {
  const [reason, setReason] = useState("");
  const [terminalId, setTerminalId] = useState(shift.terminalId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paused = Boolean(shift.pausedAt);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = paused
        ? await retailShiftsApi.resume(scope, shift._id, terminalId.trim() || undefined)
        : await retailShiftsApi.pause(scope, shift._id, reason.trim());
      onSaved(updated);
      setReason("");
      setTerminalId(updated.terminalId || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái ca.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <h3 className="text-balance text-base font-semibold text-on-surface">Phiên thu ngân</h3>
    <p className="mt-1 text-pretty text-sm text-on-surface-variant">Trạng thái: {paused ? "Tạm dừng" : "Đang hoạt động"}{shift.terminalId ? ` · Quầy ${shift.terminalId}` : ""}</p>
    {paused ? <label className="mt-3 block text-sm font-medium text-on-surface">Mã quầy khi mở lại<input maxLength={60} value={terminalId} onChange={(event) => setTerminalId(event.target.value)} aria-describedby={error ? "retail-shift-session-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary" /></label>
      : <label className="mt-3 block text-sm font-medium text-on-surface">Lý do tạm dừng<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby={error ? "retail-shift-session-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary" /></label>}
    {error && <p id="retail-shift-session-error" role="alert" className="mt-2 text-sm text-error">{error}</p>}
    <button type="button" disabled={busy || (!paused && !reason.trim())} onClick={() => void submit()} className="mt-3 min-h-11 rounded-lg border border-outline px-4 text-sm font-semibold text-on-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{busy ? "Đang xử lý..." : paused ? "Mở lại ca" : "Tạm dừng ca"}</button>
    {shift.terminalHistory?.length ? <ul className="mt-4 border-t border-outline-variant pt-3 text-sm text-on-surface-variant">{shift.terminalHistory.map((change, index) => <li key={`${change.changedAt}-${index}`}>Đổi quầy: {change.fromTerminalId || "Chưa chọn"} → {change.toTerminalId || "Chưa chọn"} · {new Date(change.changedAt).toLocaleString("vi-VN")}</li>)}</ul> : null}
  </section>;
}
