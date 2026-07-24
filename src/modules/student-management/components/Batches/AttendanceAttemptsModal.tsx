import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, MapPin } from "lucide-react";
import { ErpModal } from "../Erp/ErpUI";
import { apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

interface AttendanceAttemptsModalProps {
  isOpen: boolean;
  batchId: string;
  batchCode: string;
  onClose: () => void;
}

const REASON_LABELS: Record<string, string> = {
  verified: "Xác thực thành công",
  not_registered: "Chưa đăng ký khuôn mặt",
  invalid_image: "Ảnh không hợp lệ",
  no_face: "Không phát hiện khuôn mặt",
  multiple_faces: "Nhiều khuôn mặt trong ảnh",
  model_unavailable: "Hệ thống nhận diện tạm gián đoạn",
  spoof_detected: "Nghi giả mạo khuôn mặt (spoof)",
  face_mismatch: "Khuôn mặt không khớp hồ sơ",
  outside_radius: "Ngoài khu vực điểm danh (GPS)",
  missing_image: "Thiếu ảnh/vị trí",
  session_invalid: "Phiên QR không hợp lệ",
  replay: "Mã QR bị dùng lại",
  device_conflict: "Xung đột thiết bị",
  student_not_found: "Không tìm thấy học viên",
  not_in_batch: "Không thuộc lớp học",
  already_checked_in: "Đã điểm danh trước đó",
  code_invalid: "Mã xác thực sai",
  code_expired: "Mã xác thực hết hạn",
};

interface AttemptItem {
  id: string;
  studentName: string;
  studentPhone: string;
  channel: "qr-offline" | "online-code";
  outcome: "accepted" | "rejected" | "error";
  reasonCode: string;
  similarity?: number;
  live?: boolean;
  distanceMeters?: number;
  attemptedAt: string;
}

export function AttendanceAttemptsModal({ isOpen, batchId, batchCode, onClose }: AttendanceAttemptsModalProps) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState<"" | "accepted" | "rejected">("");

  useEffect(() => {
    if (!isOpen || !batchId) return;
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ batchId });
        if (outcomeFilter) params.set("outcome", outcomeFilter);
        const res = await apiFetch(`/attendance/attempts?${params.toString()}`);
        setAttempts(res.data || []);
      } catch {
        setAttempts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, batchId, outcomeFilter]);

  if (!isOpen) return null;

  return (
    <ErpModal title={`Lịch sử xác thực · Lớp ${batchCode}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-3 text-left">
        <div className="flex items-center gap-2">
          {(["", "accepted", "rejected"] as const).map((v) => (
            <button
              key={v || "all"}
              type="button"
              onClick={() => setOutcomeFilter(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all",
                outcomeFilter === v
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              )}
            >
              {v === "" ? "Tất cả" : v === "accepted" ? "Thành công" : "Bị từ chối"}
            </button>
          ))}
        </div>

        <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
              <p className="text-xs text-slate-400 font-semibold">Đang tải...</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <ShieldAlert className="w-8 h-8 text-slate-300" />
              <p className="text-xs text-slate-400 font-semibold">Chưa có lượt xác thực nào.</p>
            </div>
          ) : (
            attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {a.outcome === "accepted" ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{a.studentName}</p>
                    <p className="text-[10px] text-slate-400">{a.studentPhone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {a.channel === "qr-offline" ? "QR" : "Online"}
                  </span>
                  {typeof a.distanceMeters === "number" && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <MapPin className="w-3 h-3" /> {Math.round(a.distanceMeters)}m
                    </span>
                  )}
                  {typeof a.similarity === "number" && (
                    <span className="text-[10px] font-semibold text-slate-400">{Math.round(a.similarity * 100)}%</span>
                  )}
                  <span
                    className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap",
                      a.outcome === "accepted"
                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        : "text-rose-700 bg-rose-50 border border-rose-200"
                    )}
                  >
                    {REASON_LABELS[a.reasonCode] || a.reasonCode}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold whitespace-nowrap">
                    {new Date(a.attemptedAt).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ErpModal>
  );
}
