import React, { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, AlertCircle, Phone, Loader2, Sparkles, Camera, MapPin, RotateCcw } from "lucide-react";

const REASON_MESSAGES: Record<string, string> = {
  not_registered: "Học viên chưa đăng ký khuôn mặt. Vui lòng liên hệ giáo viên/admin để đăng ký trước.",
  invalid_image: "Ảnh không hợp lệ. Vui lòng chụp lại ảnh rõ mặt.",
  no_face: "Không phát hiện khuôn mặt trong ảnh. Vui lòng chụp lại, đảm bảo đủ ánh sáng.",
  multiple_faces: "Ảnh có nhiều hơn một khuôn mặt. Vui lòng chụp lại chỉ một mình bạn.",
  model_unavailable: "Hệ thống nhận diện khuôn mặt tạm thời gián đoạn. Vui lòng thử lại sau ít phút.",
  spoof_detected: "Không xác nhận được khuôn mặt thật. Vui lòng chụp ảnh trực tiếp, không dùng ảnh/video khác.",
  face_mismatch: "Khuôn mặt không khớp với hồ sơ đã đăng ký.",
  outside_radius: "Bạn đang ở ngoài khu vực điểm danh cho phép.",
  missing_image: "Vui lòng chụp ảnh khuôn mặt và cấp quyền định vị để điểm danh.",
  session_invalid: "Phiên điểm danh đã kết thúc hoặc mã QR không hợp lệ.",
  replay: "Mã QR này đã được quét và sử dụng rồi.",
  device_conflict: "Thiết bị này đã được sử dụng để điểm danh cho học viên khác.",
  student_not_found: "Số điện thoại không có trong hệ thống hoặc không đúng cơ sở.",
  not_in_batch: "Học viên không nằm trong danh sách lớp học này.",
  already_checked_in: "Bạn đã điểm danh thành công trước đó rồi.",
};

function mapReasonCode(reasonCode?: string, fallback?: string): string {
  if (reasonCode && REASON_MESSAGES[reasonCode]) return REASON_MESSAGES[reasonCode];
  return fallback || "Điểm danh không thành công.";
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
  } catch (e) {
    return hashCode(navigator.userAgent);
  }
}

export default function QRCheckinPage() {
  const [token, setToken] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [sessionInfo, setSessionInfo] = useState<{
    batchId: string;
    batchCode: string;
    courseTitle: string;
    date: string;
  } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

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
      } catch (err) {
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

  // 1. Lấy token từ URL
  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const tokenFromUrl = pathParts[pathParts.length - 1];
    if (tokenFromUrl && tokenFromUrl !== "checkin") {
      setToken(tokenFromUrl);
    } else {
      setSessionError("Không tìm thấy mã QR điểm danh trong liên kết.");
      setLoadingSession(false);
    }
  }, []);

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
      } catch (err) {
        setSessionError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSessionInfo();
  }, [token]);

  // Format ngày dd/mm/yyyy
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return dateStr.split("-").reverse().join("/");
  };

  // 3. Sau khi nhập SĐT, chuyển sang bước chụp ảnh khuôn mặt
  const handleContinueToCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 8) return;
    setCameraError(null);
    setStep("capture");
  };

  // 4. Thực hiện checkin: ảnh khuôn mặt (bắt buộc) + GPS
  const handleCheckin = async () => {
    if (!capturedPhoto) return;

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
      } catch (err) {
        setResult({
          success: false,
          error: "Không lấy được vị trí GPS. Vui lòng cấp quyền định vị cho trình duyệt và thử lại."
        });
        setSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append("token", token);
      formData.append("phone", phone.replace(/\D/g, ""));
      formData.append("fingerprint", fingerprint);
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
      formData.append("file", capturedPhoto, "checkin.jpg");

      const res = await fetch("/api/v1/qr-attendance/checkin", {
        method: "POST",
        body: formData
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
    } catch (err) {
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
    setStep("capture");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-between items-center text-slate-800 px-4 py-8 font-sans">
      {/* Header / Brand */}
      <div className="w-full max-w-md text-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-cyan-300 tracking-widest uppercase">iGen ERP Platform</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20 transition-all flex-1 flex flex-col justify-center my-auto min-h-[400px]">
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
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Điểm danh thất bại</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">{result.error}</p>
              </div>
              <button
                onClick={handleTryAgain}
                className="w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 transition-all cursor-pointer"
              >
                Quay lại thử lại
              </button>
            </div>
          )
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
              </div>

              <button
                type="submit"
                disabled={!phone || phone.length < 8}
                className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:brightness-105 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Tiếp tục chụp ảnh khuôn mặt
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
                  onClick={handleCheckin}
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
