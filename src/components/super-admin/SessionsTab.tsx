import React from "react";
import { Activity, Trash2, Monitor, Calendar, RefreshCw } from "lucide-react";
import { superAdminAuthService, type SuperAdminSession } from "../../services/superAdminAuthService";
import { ConfirmDialog } from "../common/ConfirmDialog";

export function SessionsTab() {
  const [sessions, setSessions] = React.useState<SuperAdminSession[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [currentSid, setCurrentSid] = React.useState("");
  const [pendingSessionId, setPendingSessionId] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    setError("");
    try {
      // Lấy sid của phiên hiện tại từ JWT để đánh dấu "Phiên hiện tại"
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload && payload.sid) {
            setCurrentSid(payload.sid);
          }
        } catch (e) {
          console.error("Lỗi decode token:", e);
        }
      }

      const data = await superAdminAuthService.listSessions();
      setSessions(data.sessions || []);
    } catch (e: any) {
      setError(e.message || "Lỗi khi tải danh sách phiên.");
    } finally {
      setLoading(false);
    }
  };

  const confirmRevoke = async () => {
    if (!pendingSessionId) return;
    setError("");
    setRevoking(true);
    try {
      await superAdminAuthService.revokeSession(pendingSessionId);
      setPendingSessionId(null);
      await fetchSessions();
    } catch (e: any) {
      setError(e.message || "Lỗi khi thu hồi phiên.");
    } finally {
      setRevoking(false);
    }
  };

  React.useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Monitor className="h-6 w-6 text-cyan-400" />
            Phiên hoạt động
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý các phiên đăng nhập đặc quyền Super Admin hiện có trên hệ thống.
          </p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          <span>Đang tải thông tin phiên làm việc...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-10 text-center text-slate-400">
          Không tìm thấy phiên làm việc nào.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => {
            const isCurrent = session.sessionId === currentSid;
            const isRevoked = !!session.revokedAt;
            const isExpired = new Date(session.expiresAt) < new Date();
            const isActive = !isRevoked && !isExpired;

            return (
              <div
                key={session.sessionId}
                className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                  isCurrent
                    ? "border-cyan-500/30 bg-slate-900/80 shadow-cyan-950/20"
                    : isRevoked
                    ? "border-white/5 bg-slate-950/20 opacity-60"
                    : "border-white/10 bg-slate-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        Mã phiên: {session.sessionId.slice(0, 8)}...
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                          Phiên hiện tại
                        </span>
                      )}
                      {isActive && !isCurrent && (
                        <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400 uppercase">
                          Hoạt động
                        </span>
                      )}
                      {isRevoked && (
                        <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">
                          Đã thu hồi
                        </span>
                      )}
                      {isExpired && !isRevoked && (
                        <span className="rounded-full bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                          Hết hạn
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-300 mt-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      <span>Đăng nhập lúc:</span>
                      <span className="font-semibold">
                        {new Date(session.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Activity className="h-3.5 w-3.5 text-slate-500" />
                      <span>Hoạt động cuối:</span>
                      <span className="font-semibold text-slate-300">
                        {new Date(session.lastSeenAt).toLocaleString("vi-VN")}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      <p title={session.deviceId}><span className="text-slate-500">Mã thiết bị:</span> <span className="font-mono text-slate-300">{session.deviceId || "N/A"}</span></p>
                      <p><span className="text-slate-500">IP đăng nhập:</span> {session.loginIp || "N/A"}</p>
                      <p><span className="text-slate-500">IP gần nhất:</span> {session.lastIp || "N/A"}</p>
                      <p className="break-all" title={session.userAgent}><span className="text-slate-500">Trình duyệt:</span> {session.userAgent || "N/A"}</p>
                    </div>

                    {isRevoked && (
                      <p className="text-xs text-red-400/80 italic mt-2">
                        Lý do: {session.revokeReason || "Không rõ"}
                      </p>
                    )}
                  </div>

                  {isActive && !isCurrent && (
                    <button
                      onClick={() => setPendingSessionId(session.sessionId)}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 p-2.5 text-red-400 transition-all"
                      title="Thu hồi phiên đăng nhập này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingSessionId !== null}
        title="Thu hồi phiên làm việc?"
        description="Người dùng của phiên này sẽ bị đăng xuất ngay lập tức."
        confirmLabel="Thu hồi"
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={revoking}
        onClose={() => setPendingSessionId(null)}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
