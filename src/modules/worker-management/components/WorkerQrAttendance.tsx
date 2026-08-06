import React from "react";
import QRCode from "qrcode";
import { CheckCircle2, Loader2, QrCode, X } from "lucide-react";
import { workerAttendanceApi } from "../api/workerAttendance.api";

interface WorkerQrSession {
  id: string;
  expiresAt: number;
}

interface WorkerQrStatus {
  checkedIn: number;
  closed: boolean;
  workers: Array<{ workerId: string; fullName: string; phone: string; checkinAt: number }>;
}

function formatTimeLeft(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export function WorkerQrAttendance({ projectId, date }: { projectId: string; date: string }) {
  const [session, setSession] = React.useState<WorkerQrSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [status, setStatus] = React.useState<WorkerQrStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await workerAttendanceApi.createQrSession(projectId, date);
      const sessionId: string = created.id;
      const { token } = await workerAttendanceApi.getQrToken(sessionId);
      const checkinUrl = `${window.location.origin}/worker/checkin/${token}`;
      const dataUrl = await QRCode.toDataURL(checkinUrl, { width: 320, margin: 1 });
      setSession({ id: sessionId, expiresAt: created.expiresAt });
      setQrDataUrl(dataUrl);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo phiên QR");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await workerAttendanceApi.closeQrSession(session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đóng phiên QR");
    } finally {
      setSession(null);
      setQrDataUrl("");
      setStatus(null);
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await workerAttendanceApi.getQrStatus(session.id);
        if (!cancelled) setStatus(data);
      } catch {
        // im lặng bỏ qua lỗi polling, không làm gián đoạn phiên QR đang hiển thị
      }
    };
    void poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session]);

  React.useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (session.expiresAt <= next) {
        setSession(null);
        setQrDataUrl("");
        setStatus(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return (
    <section aria-label="worker-qr-attendance" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-bold text-slate-800">
          <QrCode className="h-4 w-4 text-cyan-600" /> Điểm danh QR
        </h2>
        {!session ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Đang tạo..." : "Tạo phiên QR"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void close()}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Đóng phiên
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {session && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Mã QR điểm danh" className="h-56 w-56 rounded-xl border border-slate-200" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}
          <p className="text-xs font-semibold text-slate-500">
            Còn hiệu lực: <strong className="text-cyan-700">{formatTimeLeft(session.expiresAt - now)}</strong>
          </p>
          <p className="text-center text-xs text-slate-400">
            Lao động dùng điện thoại quét mã, nhập số điện thoại đã đăng ký và cho phép định vị để xác nhận chấm công.
          </p>

          <div className="mt-2 w-full space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Đã chấm công: {status?.checkedIn ?? 0}
            </p>
            {status && status.workers.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {status.workers.map((worker) => (
                  <div
                    key={worker.workerId}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-slate-700">{worker.fullName}</span>
                    <span className="text-slate-400">
                      {new Date(worker.checkinAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
