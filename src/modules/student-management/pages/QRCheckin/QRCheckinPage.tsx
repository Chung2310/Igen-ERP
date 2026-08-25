import React, { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, AlertCircle, Phone, Loader2, Sparkles, Camera, MapPin, RotateCcw, ExternalLink, Copy, Share2, HelpCircle } from "lucide-react";

const REASON_MESSAGES: Record<string, string> = {
  not_registered: "Học viên chưa đăng ký khuôn mặt. Vui lòng liên hệ giáo viên/admin để đăng ký trước.",
  invalid_image: "Ảnh không hợp lệ. Vui lòng chụp lại ảnh rõ mặt.",
  no_face: "Không phát hiện khuôn mặt trong ảnh. Vui lòng chụp lại, đảm bảo đủ ánh sáng.",
  multiple_faces: "Ảnh có nhiều hơn một khuôn mặt. Vui lòng chụp lại chỉ một mình bạn.",
  model_unavailable: "Hệ thống nhận diện khuôn mặt tạm thời gián đoạn. Vui lòng thử lại sau ít phút.",
  spoof_detected: "Không xác nhận được khuôn mặt thật. Vui lòng chụp ảnh trực tiếp, không dùng ảnh/video khác.",
  face_mismatch: "Khuôn mặt không khớp với hồ sơ đã đăng ký.",
  outside_radius: "Bạn đang ở ngoài khu vực điểm danh cho phép.",
  missing_image: "Vui lòng cấp quyền định vị GPS cho trình duyệt để điểm danh.",
  session_invalid: "Phiên điểm danh đã kết thúc hoặc mã QR không hợp lệ.",
  replay: "Mã QR này đã được quét và sử dụng rồi.",
  device_conflict: "Thiết bị này đã được sử dụng để điểm danh cho một học viên khác trong buổi học này (mỗi thiết bị chỉ được điểm danh 1 học viên).",
  student_not_found: "Số điện thoại chưa có trong hệ thống hoặc không đúng cơ sở.",
  not_in_batch: "Học viên không nằm trong danh sách lớp học này. Vui lòng liên hệ giáo viên.",
  worker_not_found: "Số điện thoại chưa có trong hệ thống hoặc không đúng cơ sở.",
  not_in_project: "Lao động không thuộc danh sách dự án này. Vui lòng liên hệ quản lý.",
  already_checked_in: "Bạn đã được điểm danh thành công trước đó trong buổi học này rồi.",
};

function mapReasonCode(reasonCode?: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  if (reasonCode && REASON_MESSAGES[reasonCode]) return REASON_MESSAGES[reasonCode];
  return "Điểm danh không thành công. Vui lòng thử lại hoặc liên hệ quản trị viên.";
}

// Hàm hash đơn giản cho fingerprint
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Tạo fingerprint dựa trên các thông số phần cứng & canvas trình duyệt
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
    ctx.fillText("iGen-ERP-Fingerprint", 2, 15);
    const canvasData = canvas.toDataURL();
    
    const rawData = [
      navigator.userAgent,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      canvasData
    ].join("|");
    
    return hashCode(rawData);
  } catch {
    return hashCode(navigator.userAgent);
  }
}

/**
 * QR scanners embedded in messaging/camera apps often use an ephemeral
 * webview. Cookies from that webview are not available when the user scans
 * again, so device recognition cannot be reliable there. Ask the user to
 * continue in a normal Safari/Chrome tab instead.
 */
function isEmbeddedWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const knownEmbeddedApp = /FBAN|FBAV|Instagram|Zalo|Line|MicroMessenger|Telegram|GSA|;\s*wv\)|\bwv\b/i.test(userAgent);
  const iosWebView = /iPhone|iPad|iPod/i.test(userAgent)
    && /AppleWebKit/i.test(userAgent)
    && !/Safari|CriOS|FxiOS|EdgiOS/i.test(userAgent);
  return knownEmbeddedApp || iosWebView;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function hasBrowserHandoffFlag(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("browser") === "1") return true;
  try {
    return window.localStorage.getItem("igen_qr_browser_ready") === "1";
  } catch {
    return false;
  }
}

export default function QRCheckinPage() {
  const [token] = useState<string>(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    return t && t !== "checkin" ? t : "";
  });
  const [loadingSession, setLoadingSession] = useState<boolean>(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    return !!(t && t !== "checkin"); // false ngay nếu không có token
  });
  const [sessionInfo, setSessionInfo] = useState<{
    batchId: string;
    batchCode: string;
    courseTitle: string;
    date: string;
    device?: {
      recognized: boolean;
      studentName?: string;
    };
  } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(() => {
    const parts = window.location.pathname.split("/");
    const t = parts[parts.length - 1];
    if (!t || t === "checkin") return "Không tìm thấy mã QR điểm danh trong liên kết.";
    return null;
  });
  const [embeddedWebView] = useState<boolean>(() => isEmbeddedWebView());
  const [iosDevice] = useState<boolean>(() => isIosDevice());
  const [browserReady] = useState<boolean>(() => hasBrowserHandoffFlag());
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [browserHint, setBrowserHint] = useState<string | null>(null);

  useEffect(() => {
    if (!browserReady) return;
    try {
      window.localStorage.setItem("igen_qr_browser_ready", "1");
    } catch {
      // Some private/webview contexts reject localStorage; the URL flag still works.
    }
  }, [browserReady]);

  useEffect(() => {
    if (!iosDevice || !embeddedWebView || browserReady || loadingSession || sessionInfo?.device?.recognized === true) return;
    // Keep the temporary scanner on the handoff screen, but prepare its URL so
    // the native "Open in Safari" action lands directly on the check-in flow.
    const browserUrl = new URL(window.location.href);
    browserUrl.searchParams.set("browser", "1");
    window.history.replaceState(window.history.state, "", browserUrl.toString());
  }, [browserReady, embeddedWebView, iosDevice, loadingSession, sessionInfo?.device?.recognized]);

  const [phone, setPhone] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{
    success: boolean;
    studentName?: string;
    error?: string;
  } | null>(null);

  const [step, setStep] = useState<"phone" | "capture">("phone");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (step !== "capture" || capturedPhoto) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt.");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step, capturedPhoto, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedPhoto(blob);
      setCapturedPhotoUrl(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleRetakePhoto = () => {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    setCapturedPhoto(null);
    setCapturedPhotoUrl(null);
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
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
  };

  // Token và sessionError được khởi tạo từ URL ngay trong useState — không cần effect

  // 2. Lấy thông tin lớp học từ token
  useEffect(() => {
    if (!token) return;

    const fetchSessionInfo = async () => {
      try {
        setLoadingSession(true);
        const res = await fetch(`/api/v1/qr-attendance/session-info?token=${token}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          setSessionInfo(data.data);
        } else {
          setSessionError(data.error || "Mã QR đã hết hạn hoặc không hợp lệ.");
        }
      } catch {
        setSessionError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
      } finally {
        setLoadingSession(false);
      }
    };

    void fetchSessionInfo();
  }, [token]);

  // Format ngày dd/mm/yyyy
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return dateStr.split("-").reverse().join("/");
  };

  // 3. Sau khi nhập SĐT, chuyển sang bước chụp ảnh
  const handleContinueToCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 8) return;
    void handleCheckin();
  };

  // 4. Thực hiện checkin: ảnh khuôn mặt + vị trí GPS
  const handleCheckin = async () => {
    try {
      setSubmitting(true);
      setCameraError(null);
      const fingerprint = getDeviceFingerprint();

      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        setResult({
          success: false,
          error: "Không lấy được vị trí GPS. Vui lòng cấp quyền định vị cho trình duyệt và thử lại."
        });
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/v1/qr-attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          phone: phone.replace(/\D/g, ""),
          fingerprint,
          latitude,
          longitude
        })
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          studentName: data.studentName
        });
      } else {
        setResult({
          success: false,
          error: mapReasonCode(data.reasonCode, data.error)
        });
      }
    } catch {
      setResult({
        success: false,
        error: "Đã xảy ra lỗi mạng. Vui lòng kiểm tra lại kết nối."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    setResult(null);
    handleRetakePhoto();
    setStep("phone");
  };

  const handleForgetDevice = async () => {
    try {
      await fetch("/api/v1/qr-attendance/device/forget", { method: "POST" });
      setSessionInfo((previous) => previous ? { ...previous, device: { recognized: false } } : previous);
      setPhone("");
      setResult(null);
      setStep("phone");
    } catch {
      setResult({ success: false, error: "Không thể đổi học viên. Vui lòng thử lại." });
    }
  };

  const handleOpenInBrowser = async () => {
    setBrowserHint(null);
    const browserUrl = new URL(window.location.href);
    browserUrl.searchParams.set("browser", "1");

    if (iosDevice) {
      if (!navigator.share) {
        setBrowserHint("Hãy bấm biểu tượng Safari hoặc Chia sẻ ở thanh công cụ, sau đó chọn Mở trong Safari.");
        return;
      }
      try {
        await navigator.share({
          title: "Điểm danh iGen ERP",
          text: "Mở liên kết này bằng Safari để thiết bị được ghi nhớ.",
          url: browserUrl.toString(),
        });
        setBrowserHint("Trong menu Chia sẻ, hãy chọn Mở trong Safari. Không tiếp tục trong cửa sổ quét tạm.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBrowserHint("Hãy bấm biểu tượng Safari hoặc Chia sẻ ở thanh công cụ, sau đó chọn Mở trong Safari.");
      }
      return;
    }

    const openedWindow = window.open(browserUrl.toString(), "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      setBrowserHint("Nếu trang chưa mở, hãy bấm Chia sẻ → Mở trong Safari/Chrome.");
    }
  };

  const handleCopyLink = async () => {
    try {
      const browserUrl = new URL(window.location.href);
      browserUrl.searchParams.set("browser", "1");
      await navigator.clipboard.writeText(browserUrl.toString());
      setLinkCopied(true);
      setBrowserHint("Đã sao chép link. Dán link vào Safari/Chrome để tiếp tục.");
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setBrowserHint("Không sao chép tự động được. Hãy dùng Chia sẻ → Mở trong Safari/Chrome.");
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center text-white px-4">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase animate-pulse">
          Đang tải thông tin lớp học...
        </p>
      </div>
    );
  }

  // The supported iPhone path is scanning with the Camera app, which opens
  // the normal browser. Only known embedded scanners need the handoff screen.
  const requiresBrowser = !browserReady && embeddedWebView;

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-3 py-5 font-sans text-slate-800 sm:px-4 sm:py-8">
      {/* Header / Brand */}
      <div className="w-full max-w-md text-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-cyan-300 tracking-widest uppercase">iGen ERP Platform</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="my-auto flex min-h-[360px] w-full max-w-md flex-1 flex-col justify-center rounded-3xl border border-white/20 bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all sm:min-h-[400px] sm:p-6 md:p-8">
        {sessionError ? (
          // Màn hình lỗi phiên điểm danh
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Không thể điểm danh</h2>
              <p className="text-slate-500 text-sm mt-2 font-medium">{sessionError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 transition-all cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        ) : requiresBrowser ? (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto text-cyan-600 shadow-inner">
              <ExternalLink className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{iosDevice ? "Mở bằng Safari" : "Mở bằng Safari/Chrome"}</h2>
              <p className="text-sm text-slate-500 font-medium">
                {iosDevice
                  ? "iPhone đang mở liên kết trong trình duyệt tạm. Hãy dùng biểu tượng Safari hoặc menu Chia sẻ và chọn Mở trong Safari để thiết bị được ghi nhớ."
                  : "Bạn đang mở link trong trình quét tạm thời. Hãy mở link bằng trình duyệt chính để thiết bị được ghi nhớ cho những lần điểm danh sau."}
              </p>
              {sessionInfo && (
                <p className="text-xs text-slate-400 font-semibold">Lớp {sessionInfo.batchCode} · Buổi {formatDate(sessionInfo.date)}</p>
              )}
            </div>
            {iosDevice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-xs font-semibold text-amber-800 space-y-1.5">
                <p>1. Bấm nút Mở menu Chia sẻ bên dưới.</p>
                <p>2. Chọn Mở trong Safari hoặc bấm biểu tượng Safari của trình quét.</p>
                <p>3. Chỉ nhập SĐT lần đầu trong Safari; lần sau hệ thống tự nhận diện.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleOpenInBrowser()}
              className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {iosDevice ? <Share2 className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              {iosDevice ? "Mở menu Chia sẻ" : "Mở trong trình duyệt"}
            </button>
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="w-full h-11 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {linkCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {linkCopied ? "Đã sao chép link" : "Sao chép link để mở bằng Safari/Chrome"}
            </button>
            <p className="text-[11px] text-slate-400 font-medium">
              Link vẫn dùng được trong suốt thời lượng phiên điểm danh; khi phiên đóng hoặc hết giờ, link sẽ hết hiệu lực.
            </p>
            {browserHint && <p className="text-xs text-amber-600 font-semibold">{browserHint}</p>}
          </div>
        ) : result ? (
          // Màn hình kết quả Check-in
          result.success ? (
            <div className="text-center space-y-6 animate-fade-in">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
                <CheckCircle2 className="w-14 h-14 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Thành Công!</h2>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl py-3 px-4 inline-block max-w-xs mx-auto">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Học viên</p>
                  <p className="text-base font-extrabold text-slate-800 mt-1">{result.studentName}</p>
                </div>
                <p className="text-slate-500 text-sm font-medium mt-3">
                  Bạn đã điểm danh thành công vào buổi học ngày {formatDate(sessionInfo?.date)}.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-2 text-left">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Lớp học:</span>
                  <span className="text-slate-700 font-bold">{sessionInfo?.batchCode}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Khóa học:</span>
                  <span className="text-slate-700 font-bold text-right max-w-[200px] truncate">{sessionInfo?.courseTitle}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Bạn có thể đóng trình duyệt bây giờ.</p>
            </div>
          ) : (
            <div className="text-center space-y-5">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Điểm danh không thành công</h2>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-left">
                  <p className="text-xs font-semibold leading-relaxed text-rose-700">{result.error}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left text-[11px] text-slate-500 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-600" /> Lưu ý quan trọng:
                </div>
                <p>• Nếu số điện thoại chưa có trong lớp: hãy liên hệ giáo viên để được thêm vào danh sách lớp.</p>
                <p>• Nếu thiết bị đã được điểm danh: mỗi máy/trình duyệt chỉ được điểm danh cho 1 học viên trong buổi học.</p>
                <p>• Bạn có thể bấm "Đổi số điện thoại" để nhập lại số điện thoại khác.</p>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="w-full h-13 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 transition-all cursor-pointer"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => void handleForgetDevice()}
                  className="w-full h-11 border border-slate-200 bg-white text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Đổi số điện thoại / Đổi học viên
                </button>
              </div>
            </div>
          )
        ) : sessionInfo?.device?.recognized ? (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Xin chào {sessionInfo.device.studentName}</h2>
              <p className="text-sm text-slate-500 font-medium">Thiết bị này đã được ghi nhớ. Bạn không cần nhập lại số điện thoại.</p>
              <p className="text-xs text-slate-400 font-semibold">Lớp {sessionInfo.batchCode} · Buổi {formatDate(sessionInfo.date)}</p>
            </div>
            <button
              onClick={() => void handleCheckin()}
              disabled={submitting}
              className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang điểm danh...</> : <><MapPin className="w-4 h-4" /> Điểm danh ngay</>}
            </button>
            <button
              type="button"
              onClick={() => void handleForgetDevice()}
              className="w-full text-xs font-bold text-slate-500 hover:text-cyan-700 transition-colors"
            >
              Không phải tôi / Đổi học viên
            </button>
          </div>
        ) : step === "phone" ? (
          // Màn hình nhập SĐT để điểm danh
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Điểm danh Lớp học</h2>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lớp</span>
                  <span className="text-xs font-extrabold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md">{sessionInfo?.batchCode}</span>
                </div>
                <div className="text-xs font-bold text-slate-800 line-clamp-1">
                  {sessionInfo?.courseTitle}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Buổi học: {formatDate(sessionInfo?.date)}
                </div>
              </div>
            </div>

            <form onSubmit={handleContinueToCapture} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Số điện thoại đã đăng ký
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="Ví dụ: 0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  * Mỗi thiết bị chỉ được điểm danh cho 1 học viên trong mỗi buổi học.
                </p>
              </div>

              <button
                type="submit"
                disabled={!phone || phone.length < 8 || submitting}
                className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:brightness-105 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Xác nhận điểm danh
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          // Màn hình chụp ảnh khuôn mặt + xác nhận điểm danh
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Chụp ảnh khuôn mặt</h2>
              <p className="text-xs text-slate-500 font-medium">
                Nhìn thẳng vào camera, đủ ánh sáng, chỉ một mình bạn trong khung hình.
              </p>
            </div>

            {cameraError ? (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center text-sm text-rose-600 font-semibold">
                {cameraError}
              </div>
            ) : (
              <div className="relative aspect-[4/3] w-full bg-slate-900 rounded-2xl overflow-hidden">
                {capturedPhotoUrl ? (
                  <img src={capturedPhotoUrl} alt="Ảnh đã chụp" className="w-full h-full object-cover" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                )}
              </div>
            )}

            {!capturedPhoto ? (
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!!cameraError}
                className="w-full h-14 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-lg active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Chụp ảnh
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void handleCheckin()}
                  disabled={submitting}
                  className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:brightness-105 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xác thực...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      Xác nhận Điểm danh
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRetakePhoto}
                  disabled={submitting}
                  className="w-full h-11 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Chụp lại
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => { stopCamera(); handleRetakePhoto(); setStep("phone"); }}
              disabled={submitting}
              className="w-full text-center text-[11px] text-slate-400 font-semibold underline disabled:opacity-50"
            >
              Quay lại nhập số điện thoại
            </button>
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
