import React from "react";
import { LockKeyhole, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useRetailScope } from "../hooks/useRetailScope";
import { retailShiftsApi } from "../api/retailShifts.api";
import { socketService } from "../../../services/socketService";
import { getApiErrorMessage } from "../../../utils/errorMessage";

import RetailPosPage from "./RetailPosPage";
import type { RetailShift } from "../types";

export default function RetailPosEntry() {
  const { userProfile, logout } = useAuth();
  const { scope, branchName } = useRetailScope();
  const [shift, setShift] = React.useState<RetailShift | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [connected, setConnected] = React.useState(socketService.isConnected());
  const [showCloseForm, setShowCloseForm] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestId = React.useRef(0);
  const leaving = React.useRef(false);
  const canLeavePos = userProfile?.role !== "pos_cashier" && (userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.some((permission) => ["*", "retail:manage", "retail:read"].includes(permission))));
  const showError = (cause: unknown) => setError(getApiErrorMessage(cause, "Không xử lý được phiên POS."));

  const refresh = React.useCallback(async () => {
    if (leaving.current) return;
    const currentRequest = ++requestId.current;
    if (!scope) { setShift(null); setLoading(false); return; }
    try {
      let result = await retailShiftsApi.current(scope);
      if (result && !result.terminalId && currentRequest === requestId.current && !leaving.current) result = await retailShiftsApi.resume(scope, result._id);
      if (currentRequest === requestId.current && !leaving.current) {
        setShift(result);
        if (!result) setShowCloseForm(false);
        setError("");
      }
    } catch (cause) {
      if (currentRequest === requestId.current) showError(cause);
    } finally { if (currentRequest === requestId.current) setLoading(false); }
  }, [scope?.companyCode, scope?.branchId, scope?.terminalId]);

  React.useEffect(() => { setShift(null); setLoading(true); void refresh(); return () => { ++requestId.current; }; }, [refresh]);
  React.useEffect(() => {
    const sync = (event: any) => {
      if (event?.companyCode === scope?.companyCode && event?.branchId === scope?.branchId && event?.cashierId === userProfile?.uid) void refresh();
    };
    const off = ["opened", "closed", "reconciled", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, sync));
    off.push(socketService.onStatusChange((value) => { setConnected(value); if (value) void refresh(); }));
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    // Recover missed events, including a server restart around midnight.
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    return () => { off.forEach((dispose) => dispose()); document.removeEventListener("visibilitychange", onFocus); window.clearInterval(interval); };
  }, [scope?.companyCode, scope?.branchId, userProfile?.uid, refresh]);
  React.useEffect(() => {
    if (!shift?.operationalEndsAt) return;
    const timer = window.setTimeout(() => void refresh(), Math.min(2147000000, Math.max(0, new Date(shift.operationalEndsAt).getTime() - Date.now() + 1)));
    return () => window.clearTimeout(timer);
  }, [shift?._id, shift?.operationalEndsAt, refresh]);

  const leavePos = () => { window.history.pushState(null, "", "/ban-le"); window.dispatchEvent(new Event("popstate")); };
  React.useEffect(() => {
    if (loading || !scope || shift || !canLeavePos || error) return;
    window.history.replaceState(null, "", "/ban-le");
    window.dispatchEvent(new Event("popstate"));
  }, [loading, scope, shift, canLeavePos, error]);
  const signOut = async () => {
    leaving.current = true; ++requestId.current; setBusy(true);
    try {
      if (scope && shift?.terminalId === scope.terminalId) await retailShiftsApi.pause(scope, shift._id);
      await logout();
    } catch (cause) { leaving.current = false; showError(cause); void refresh(); }
    finally { setBusy(false); }
  };
  const resume = async () => {
    if (!scope || !shift || busy) return;
    setBusy(true);
    try { setShift(await retailShiftsApi.resume(scope, shift._id, shift.terminalId)); setError(""); }
    catch (cause) { showError(cause); }
    finally { setBusy(false); }
  };
  const closeShift = async () => {
    if (!scope || !shift || busy) return;
    setBusy(true);
    try {
      await retailShiftsApi.close(scope, shift._id, {});
      setShift(null); setShowCloseForm(false); setError("");
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  };
  const logoutButton = <button type="button" disabled={busy} onClick={() => void signOut()} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50">Đăng xuất</button>;

  if (loading) return <Message><RefreshCw className="h-6 w-6 animate-spin" />Đang tải phiên POS…</Message>;
  if (!scope) return <Message><p>Tài khoản chưa được gán chi nhánh bán hàng.</p>{logoutButton}</Message>;
  if (!shift && canLeavePos && !error) return <Message><RefreshCw className="h-6 w-6 animate-spin" />Đang mở trang quản lý bán hàng…</Message>;
  if (!shift || shift.terminalId !== scope.terminalId) return <Message>
    <section className="w-full max-w-lg rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
      <p className="text-sm font-bold text-[#0758d5]">{branchName || "Quầy bán hàng"} · {userProfile?.displayName}</p>
      <h1 className="mt-3 text-2xl font-black">{shift ? "Phiên đang mở trên máy khác" : "Chưa có phiên bán hàng"}</h1>
      <p className="mt-3 text-sm text-slate-500">{shift ? "Bạn có thể tiếp tục bán hàng trên máy này. Máy kia sẽ dừng bán hàng." : "Hãy chờ quản lý mở phiên. Màn hình bán hàng sẽ tự hiện sau đó."}</p>
      <p className="mt-3 text-xs text-slate-500">{connected ? "Đã kết nối" : "Đang kết nối..."}</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {shift && <button type="button" disabled={busy} onClick={() => void resume()} className="mt-5 w-full rounded-xl bg-[#0866f5] px-4 py-3 font-bold text-white hover:bg-[#0758d5] disabled:opacity-50">Tiếp tục trên máy này</button>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-xl border px-3 py-2 text-sm font-semibold">Tải lại</button>
        {canLeavePos && <button type="button" onClick={leavePos} className="rounded-xl border px-3 py-2 text-sm font-semibold">Màn quản lý</button>}
        {logoutButton}
      </div>
    </section>
  </Message>;
  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-100">
    <RetailPosPage key={`${scope.companyCode}:${scope.branchId}:${userProfile?.uid}`} posSessionId={shift._id} onCloseShift={() => setShowCloseForm(true)} canLeavePos={canLeavePos} onLeavePos={leavePos} onLogout={() => void signOut()} />
    {error && <p role="alert" className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-rose-700 px-4 py-3 text-sm text-white">{error}</p>}
    {showCloseForm && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowCloseForm(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pos-close-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#0866f5]"><LockKeyhole className="h-5 w-5" /></span><h2 id="pos-close-title" className="text-lg font-bold text-slate-950">Bạn có muốn đóng phiên này không?</h2></div>
          <button type="button" disabled={busy} aria-label="Đóng" onClick={() => setShowCloseForm(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={() => setShowCloseForm(false)} className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Không</button>
          <button type="button" disabled={busy} onClick={() => void closeShift()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0866f5] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0758d5] disabled:opacity-50">{busy && <RefreshCw className="h-4 w-4 animate-spin" />}{busy ? "Đang đóng…" : "Có, đóng phiên"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
function Message({ children }: { children: React.ReactNode }) { return <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-lg font-semibold text-slate-800">{children}</main>; }
