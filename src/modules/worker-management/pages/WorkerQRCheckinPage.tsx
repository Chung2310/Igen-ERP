import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Phone,
  Loader2,
  HardHat,
  MapPin,
  RotateCcw,
} from "lucide-react";

// ─── Thông báo lỗi chuyên biệt cho lao động ──────────────────────────────────
const REASON_MESSAGES: Record<string, string> = {
  session_invalid: "Phiên chấm công đã kết thúc hoặc mã QR không hợp lệ.",
  replay: "Mã QR này đã được quét và sử dụng rồi.",
  device_conflict: "Thiết bị này đã được dùng để chấm công cho lao động khác.",
  worker_not_found:
    "Số điện thoại không có trong hệ thống hoặc không đúng dự án.",
  student_not_found:
    "Số điện thoại không có trong hệ thống hoặc không đúng dự án.",
  not_in_batch: "Lao động không nằm trong danh sách dự án này.",
  already_checked_in: "Bạn đã chấm công thành công trước đó rồi.",
  outside_radius: "Bạn đang ở ngoài khu vực chấm công cho phép.",
};

function mapReasonCode(reasonCode?: string, fallback?: string): string {
  if (reasonCode && REASON_MESSAGES[reasonCode])
    return REASON_MESSAGES[reasonCode];
  return fallback || "Chấm công không thành công.";
}

// ─── Fingerprint thiết bị ─────────────────────────────────────────────────────
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getDeviceFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return hashCode(navigator.userAgent);
    ctx.textBaseline = "top";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("iGen-ERP-Worker-FP", 2, 15);
    const rawData = [
      navigator.userAgent,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join("|");
    return hashCode(rawData);
  } catch {
    return hashCode(navigator.userAgent);
  }
}

// ─── Format ngày dd/mm/yyyy ───────────────────────────────────────────────────
function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return dateStr.split("-").reverse().join("/");
}

// ─── Lấy GPS ─────────────────────────────────────────────────────────────────
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

// ─── Kiểu dữ liệu ────────────────────────────────────────────────────────────
interface WorkerSessionInfo {
  projectId: string;
  projectCode: string;
  projectName: string;
  date: string;
  device?: {
    recognized: boolean;
    workerName?: string;
  };
}

interface CheckinResult {
  success: boolean;
  workerName?: string;
  error?: string;
}

// ─── Component chính ─────────────────────────────────────────────────────────
export default function WorkerQRCheckinPage() {
  const [token] = useState(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    return t && t !== "checkin" ? t : "";
  });
  const [loadingSession, setLoadingSession] = useState(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    return !!(t && t !== "checkin");
  });
  const [sessionInfo, setSessionInfo] = useState<WorkerSessionInfo | null>(
    null
  );
  const [sessionError, setSessionError] = useState<string | null>(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    if (!t || t === "checkin") return "Không tìm thấy mã QR chấm công trong liên kết.";
    return null;
  });

  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);

  // Token và sessionError khởi tạo từ URL ngay trong useState — không cần effect

  // 2. Lấy thông tin phiên chấm công từ token
  useEffect(() => {
    if (!token) return;
    const fetch_ = async () => {
      try {
        setLoadingSession(true);
        const res = await fetch(
          `/api/v1/worker-management/qr-attendance/session-info?token=${token}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setSessionInfo(data.data);
        } else {
          setSessionError(
            data.error || "Mã QR đã hết hạn hoặc không hợp lệ."
          );
        }
      } catch {
        setSessionError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
      } finally {
        setLoadingSession(false);
      }
    };
    void fetch_();
  }, [token]);

  // 3. Thực hiện chấm công
  const handleCheckin = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const rememberedDevice = sessionInfo?.device?.recognized === true;
    if (!rememberedDevice && (!phone || phone.length < 8)) return;

    setSubmitting(true);
    try {
      const fingerprint = getDeviceFingerprint();

      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await getCurrentPosition();
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        setResult({
          success: false,
          error:
            "Không lấy được vị trí GPS. Vui lòng cấp quyền định vị cho trình duyệt và thử lại.",
        });
        return;
      }

      const res = await fetch("/api/v1/worker-management/qr-attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          phone: rememberedDevice ? "" : phone.replace(/\D/g, ""),
          fingerprint,
          latitude,
          longitude,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          workerName: data.data?.workerName ?? data.workerName,
        });
      } else {
        setResult({
          success: false,
          error: mapReasonCode(data.reasonCode, data.error),
        });
      }
    } catch {
      setResult({
        success: false,
        error: "Đã xảy ra lỗi mạng. Vui lòng kiểm tra lại kết nối.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  const handleForgetDevice = async () => {
    try {
      await fetch("/api/v1/worker-management/qr-attendance/device/forget", { method: "POST" });
      setSessionInfo((previous) => previous ? { ...previous, device: { recognized: false } } : previous);
      setPhone("");
      setResult(null);
    } catch {
      setResult({ success: false, error: "Không thể đổi lao động. Vui lòng thử lại." });
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950 to-orange-950 flex flex-col justify-center items-center text-white px-4">
        <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase animate-pulse">
          Đang tải thông tin dự án...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950 to-orange-950 flex flex-col justify-between items-center text-slate-800 px-4 py-8 font-sans">
      {/* Brand */}
      <div className="w-full max-w-md text-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/20 mb-3">
          <HardHat className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-300 tracking-widest uppercase">
            iGen ERP — Lao động
          </span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20 flex-1 flex flex-col justify-center my-auto min-h-[360px]">
        {/* ── Lỗi phiên ─────────────────────────────────────────── */}
        {sessionError ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Không thể chấm công
              </h1>
              <p className="text-slate-500 text-sm mt-2 font-medium">
                {sessionError}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>

        /* ── Kết quả chấm công ────────────────────────────────── */
        ) : result ? (
          result.success ? (
            <div className="text-center space-y-6 animate-fade-in">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
                <CheckCircle2 className="w-14 h-14 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Chấm công thành công!
                </h1>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl py-3 px-4 inline-block max-w-xs mx-auto">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                    Lao động
                  </p>
                  <p className="text-base font-extrabold text-slate-800 mt-1">
                    {result.workerName}
                  </p>
                </div>
                <p className="text-slate-500 text-sm font-medium mt-3">
                  Bạn đã chấm công thành công cho ngày{" "}
                  {formatDate(sessionInfo?.date)}.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-2 text-left">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Mã dự án:</span>
                  <span className="text-slate-700 font-bold">
                    {sessionInfo?.projectCode}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Tên dự án:</span>
                  <span className="text-slate-700 font-bold text-right max-w-[200px] truncate">
                    {sessionInfo?.projectName}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Bạn có thể đóng trình duyệt bây giờ.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Chấm công thất bại
                </h1>
                <p className="text-slate-500 text-sm mt-2 font-medium">
                  {result.error}
                </p>
              </div>
              <button
                onClick={() => setResult(null)}
                className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Quay lại thử lại
              </button>
            </div>
          )

        /* ── Form nhập SĐT ────────────────────────────────────── */
        ) : sessionInfo?.device?.recognized ? (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Xin chào {sessionInfo.device.workerName}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Thiết bị này đã được ghi nhớ. Bạn không cần nhập lại số điện thoại.
              </p>
              <p className="text-xs text-slate-400 font-semibold">
                Dự án {sessionInfo.projectCode} · Ngày {formatDate(sessionInfo.date)}
              </p>
            </div>
            <button
              onClick={(event) => void handleCheckin(event)}
              disabled={submitting}
              className="w-full h-14 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang chấm công...</> : <><MapPin className="w-4 h-4" /> Chấm công ngay</>}
            </button>
            <button
              type="button"
              onClick={() => void handleForgetDevice()}
              className="w-full text-xs font-bold text-slate-500 hover:text-amber-700 transition-colors"
            >
              Không phải tôi / Đổi lao động
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Chấm công Dự án
              </h1>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mã dự án
                  </span>
                  <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    {sessionInfo?.projectCode}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 line-clamp-1">
                  {sessionInfo?.projectName}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Ngày chấm công: {formatDate(sessionInfo?.date)}
                </div>
              </div>
            </div>

            <form onSubmit={(e) => void handleCheckin(e)} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="worker-phone-input"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Số điện thoại đã đăng ký
                </label>
                <input
                  id="worker-phone-input"
                  type="tel"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="Ví dụ: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Hệ thống sẽ xác minh vị trí GPS của bạn. Vui lòng cho phép
                  trình duyệt truy cập định vị.
                </span>
              </div>

              <button
                id="worker-checkin-submit"
                type="submit"
                disabled={!phone || phone.length < 8 || submitting}
                className="w-full h-14 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xác thực...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Chấm công ngay
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-500 font-semibold">
          © {new Date().getFullYear()} iGen-ERP. Bảo mật &amp; Đáng tin cậy.
        </p>
      </div>
    </div>
  );
}
