import React from "react";
import { workerAttendanceApi } from "../api/workerAttendance.api";

export function WorkerQrAttendance({ projectId, date }: { projectId: string; date: string }) {
  const [session, setSession] = React.useState<any>(null);
  const [token, setToken] = React.useState<any>(null);
  const [status, setStatus] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const start = async () => { setBusy(true); setError(""); try { const created = await workerAttendanceApi.createQrSession(projectId, date); setSession(created); setToken(await workerAttendanceApi.getQrToken(created.sessionId || created._id)); } catch (e) { setError(e instanceof Error ? e.message : "Không thể tạo phiên QR"); } finally { setBusy(false); } };
  const refresh = async () => { if (!session) return; try { setStatus(await workerAttendanceApi.getQrStatus(session.sessionId || session._id)); } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải trạng thái QR"); } };
  const close = async () => { if (!session) return; setBusy(true); try { await workerAttendanceApi.closeQrSession(session.sessionId || session._id); setSession(null); setToken(null); setStatus(null); } catch (e) { setError(e instanceof Error ? e.message : "Không thể đóng phiên QR"); } finally { setBusy(false); } };
  return <section aria-label="worker-qr-attendance" className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-800">Điểm danh QR</h2>{!session ? <button type="button" onClick={() => void start()} disabled={busy} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white">Tạo phiên</button> : <button type="button" onClick={() => void close()} disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Đóng phiên</button>}</div>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}{session && <div className="mt-3 space-y-2 text-sm"><p>Session: <strong>{session.sessionId || session._id}</strong></p><p>Token: <strong>{token?.token || token?.value || "Đang tải..."}</strong></p><p>Trạng thái: {status?.status || "Chưa kiểm tra"}</p><button type="button" onClick={() => void refresh()} className="text-xs font-bold text-cyan-700">Cập nhật trạng thái</button></div>}</section>;
}
