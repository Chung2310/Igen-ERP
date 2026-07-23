import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { toast } from "../../pages/Toast";
import AttendanceCameraModal from "../attendance/AttendanceCameraModal";

export function getTimekeepingStatusDisplay(
  hasCheckIn: boolean,
  hasCheckOut: boolean,
  timekeepingStatus: string | undefined,
  workCalendar: { date: string; isWorkingDay: boolean; label?: string } | null
): { statusText: string; statusColor: string; statusBadge: string } {
  const isNonWorkingDay = workCalendar != null && !workCalendar.isWorkingDay;

  if (hasCheckIn) {
    if (hasCheckOut) {
      return { statusText: "Đã hoàn thành chấm công", statusColor: "bg-blue-500", statusBadge: "bg-blue-50 text-blue-700 ring-blue-500/10" };
    }
    return timekeepingStatus === "Late"
      ? { statusText: "Đã check-in (Muộn)", statusColor: "bg-amber-500", statusBadge: "bg-amber-50 text-amber-700 ring-amber-500/10" }
      : { statusText: "Đã check-in (Đúng giờ)", statusColor: "bg-emerald-500", statusBadge: "bg-emerald-50 text-emerald-700 ring-emerald-500/10" };
  }

  if (isNonWorkingDay) {
    return { statusText: workCalendar?.label || "Ngày nghỉ", statusColor: "bg-slate-400", statusBadge: "bg-slate-50 text-slate-600 ring-slate-500/10" };
  }

  return { statusText: "Chưa chấm công", statusColor: "bg-rose-500", statusBadge: "bg-rose-50 text-rose-700 ring-rose-500/10" };
}

export function TimekeepingWidget({
  todayTimekeeping,
  todayWorkCalendar,
  isLoading,
  onRefresh,
}: {
  todayTimekeeping: any;
  todayWorkCalendar: { date: string; isWorkingDay: boolean; label?: string } | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [checking, setChecking] = useState<"in" | "out" | null>(null);
  const [gpsPermission, setGpsPermission] = useState<"granted" | "denied" | "prompt" | "unsupported">("prompt");
  const [cameraAction, setCameraAction] = useState<"in" | "out" | null>(null);
  const pendingCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        setGpsPermission(status.state as any);
        status.onchange = () => {
          setGpsPermission(status.state as any);
        };
      }).catch(() => {
        setGpsPermission("prompt");
      });
    } else {
      setGpsPermission("unsupported");
    }
  }, []);

  const FACE_REASON_MESSAGES: Record<string, string> = {
    invalid_image: "Ảnh không hợp lệ, vui lòng chụp lại.",
    no_face: "Không phát hiện khuôn mặt trong ảnh.",
    multiple_faces: "Ảnh có nhiều khuôn mặt, vui lòng chụp lại một mình.",
    spoof_detected: "Hệ thống nghi ngờ ảnh giả mạo (ảnh chụp qua màn hình/ảnh in). Vui lòng chụp trực tiếp.",
    face_mismatch: "Khuôn mặt không khớp với hồ sơ đã đăng ký.",
    not_registered: "Bạn chưa đăng ký khuôn mặt. Vui lòng liên hệ quản trị viên.",
    model_unavailable: "Hệ thống nhận diện khuôn mặt tạm thời không khả dụng. Vui lòng thử lại sau.",
  };

  const handleAction = async (type: "in" | "out") => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    setChecking(type);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pendingCoordsRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setChecking(null);
        setCameraAction(type);
      },
      (error) => {
        setChecking(null);
        console.error("Lỗi định vị:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Vui lòng cho phép truy cập vị trí trên trình duyệt để chấm công.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không thể xác định vị trí hiện tại.");
            break;
          case error.TIMEOUT:
            toast.error("Thời gian định vị GPS hết hạn.");
            break;
          default:
            toast.error("Lỗi định vị không xác định.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleCameraCapture = async (image: Blob) => {
    const type = cameraAction;
    const coords = pendingCoordsRef.current;
    if (!type || !coords) {
      throw new Error("Thiếu vị trí GPS, vui lòng thử lại từ đầu.");
    }

    const formData = new FormData();
    formData.append("file", image, "attendance.jpg");
    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));
    formData.append("deviceInfo", navigator.userAgent);

    const url = type === "in" ? "/api/v1/timekeeping/check-in" : "/api/v1/timekeeping/check-out";
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });
    } catch {
      throw new Error("Lỗi kết nối khi gửi dữ liệu chấm công.");
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reasonMessage = result.reasonCode ? FACE_REASON_MESSAGES[result.reasonCode] : undefined;
      throw new Error(reasonMessage || result.message || `Không thể Check-${type}.`);
    }

    toast.success(result.message || `Check-${type} thành công!`);
    pendingCoordsRef.current = null;
    onRefresh();
    window.dispatchEvent(new CustomEvent("timekeeping-mutation"));
  };

  const hasCheckIn = !!todayTimekeeping?.checkIn;
  const hasCheckOut = !!todayTimekeeping?.checkOut;

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const { statusText, statusColor, statusBadge } = getTimekeepingStatusDisplay(
    hasCheckIn,
    hasCheckOut,
    todayTimekeeping?.status,
    todayWorkCalendar
  );

  return (
    <div className="w-full bg-white/70 backdrop-blur-md border border-slate-150 rounded-3xl p-6 shadow-xs relative overflow-hidden transition-all hover:shadow-md duration-300 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4 text-left w-full md:w-auto">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-650 ring-4 ring-indigo-500/10">
              <Clock className="h-7 w-7" />
            </div>
            <span className={`absolute -top-1 -right-1 flex h-4.5 w-4.5 rounded-full ${statusColor} border-2 border-white items-center justify-center shadow-xs`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColor} opacity-75`} />
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-gray-800">Chấm công GPS hàng ngày</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${statusBadge}`}>
                {statusText}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {hasCheckIn ? (
                <>
                  Vào: <span className="font-bold text-gray-700">{formatTime(todayTimekeeping.checkIn.time)}</span>
                  {todayTimekeeping.checkIn.distance > 0 && ` (${Math.round(todayTimekeeping.checkIn.distance)}m)`}
                  {hasCheckOut && (
                    <>
                      {" · "}Ra: <span className="font-bold text-gray-700">{formatTime(todayTimekeeping.checkOut.time)}</span>
                      {todayTimekeeping.checkOut.distance > 0 && ` (${Math.round(todayTimekeeping.checkOut.distance)}m)`}
                    </>
                  )}
                </>
              ) : (
                "Vui lòng bật định vị và thực hiện Check-in đúng giờ quy định."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => handleAction("in")}
            disabled={hasCheckIn || checking !== null || isLoading}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 cursor-pointer ${
              hasCheckIn
                ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed border border-slate-300/40"
                : checking === "in"
                ? "bg-indigo-400 cursor-wait animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-600/10"
            }`}
          >
            {checking === "in" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Check-In"
            )}
          </button>

          <button
            onClick={() => handleAction("out")}
            disabled={!hasCheckIn || hasCheckOut || checking !== null || isLoading}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 cursor-pointer ${
              !hasCheckIn || hasCheckOut
                ? "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed border border-slate-300/40"
                : checking === "out"
                ? "bg-emerald-400 cursor-wait animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-emerald-600/10"
            }`}
          >
            {checking === "out" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Check-Out"
            )}
          </button>
        </div>
      </div>

      {gpsPermission === "prompt" && (
        <div className="w-full p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-2xl flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-indigo-600" />
          <span className="text-[11px] font-semibold text-left">iGen ERP cần quyền vị trí của bạn để chấm công. Vui lòng chọn "Cho phép" (Allow) khi trình duyệt yêu cầu.</span>
        </div>
      )}

      {gpsPermission === "denied" && (
        <div className="w-full p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-center gap-2">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
          <span className="text-[11px] font-semibold text-left">Bạn đã chặn quyền truy cập vị trí. Vui lòng mở cài đặt trình duyệt, cho phép quyền truy cập vị trí và tải lại trang để chấm công.</span>
        </div>
      )}

      {cameraAction && (
        <AttendanceCameraModal
          action={cameraAction}
          onCapture={handleCameraCapture}
          onClose={() => {
            pendingCoordsRef.current = null;
            setCameraAction(null);
          }}
        />
      )}
    </div>
  );
}
