import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Phone, Loader2, Sparkles, User } from "lucide-react";

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

  // 3. Thực hiện checkin
  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 8) return;

    try {
      setSubmitting(true);
      const fingerprint = getDeviceFingerprint();
      
      const res = await fetch("/api/v1/qr-attendance/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          phone: phone.replace(/\D/g, ""),
          fingerprint
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
          error: data.error || "Điểm danh thất bại."
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
                onClick={() => setResult(null)}
                className="w-full h-14 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl active:scale-98 transition-all cursor-pointer"
              >
                Quay lại thử lại
              </button>
            </div>
          )
        ) : (
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

            <form onSubmit={handleCheckin} className="space-y-4">
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
                disabled={submitting || !phone || phone.length < 8}
                className="w-full h-14 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl hover:brightness-105 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang điểm danh...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Xác nhận Điểm danh
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
