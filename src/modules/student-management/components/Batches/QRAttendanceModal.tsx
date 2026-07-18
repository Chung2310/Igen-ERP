import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Loader2, Users, Clock, Check, X, ShieldAlert, Sparkles } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { toast } from "../../../../pages/Toast";
import { socketService } from "../../../../services/socketService";
import { cn } from "../../lib/utils";

interface QRAttendanceModalProps {
  isOpen: boolean;
  batch: {
    id: string;
    code: string;
    courseTitle: string;
    learnerIds: string[];
  };
  date: string;
  students: Array<{
    id: string;
    fullName: string;
    phone: string;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function QRAttendanceModal({
  isOpen,
  batch,
  date,
  students,
  onClose,
  onSuccess,
}: QRAttendanceModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 phút đếm ngược (giây)
  const [tokenTimeRemaining, setTokenTimeRemaining] = useState<number>(30); // 30s xoay QR
  const [loading, setLoading] = useState<boolean>(true);
  const [closing, setClosing] = useState<boolean>(false);

  // Danh sách các ID học viên đã check-in thành công
  const [checkedInMap, setCheckedInMap] = useState<Map<string, { checkinAt: number }>>(new Map());
  // Học viên vừa checkin mới nhất để tạo hiệu ứng animation highlight
  const [newlyCheckedInId, setNewlyCheckedInId] = useState<string | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const newlyCheckedInTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format ngày dd/mm/yyyy
  const formatDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");

  // Format giây thành mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // 1. Tạo phiên điểm danh khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    const startSession = async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/qr-attendance/session", {
          method: "POST",
          body: JSON.stringify({ batchId: batch.id, date, durationMinutes: 5 }),
        });

        if (res.sessionId) {
          setSessionId(res.sessionId);
          setQrToken(res.token);
          setExpiresAt(res.expiresAt);
          setTokenExpiresAt(res.tokenExpiresAt);

          // Tính thời gian còn lại dựa trên đồng hồ thực tế
          const now = Date.now();
          const remainingSecs = Math.max(0, Math.floor((res.expiresAt - now) / 1000));
          const tokenRemainingSecs = Math.max(0, Math.floor((res.tokenExpiresAt - now) / 1000));
          setTimeRemaining(remainingSecs);
          setTokenTimeRemaining(tokenRemainingSecs);
        } else {
          toast.error("Không thể khởi tạo phiên điểm danh QR.");
          onClose();
        }
      } catch (err: any) {
        toast.error(err.message || "Đã xảy ra lỗi khi tạo phiên.");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    startSession();
  }, [isOpen, batch.id, date, onClose]);

  // 2. Tạo QR Code khi token thay đổi
  useEffect(() => {
    if (!qrToken) return;
    const url = `${window.location.origin}/attendance/checkin/${qrToken}`;
    QRCode.toDataURL(url, {
      width: 260,
      margin: 1.5,
      color: {
        dark: "#0f172a", // slate-900
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("Error generating QRCode:", err));
  }, [qrToken]);

  // 3. Đăng ký Socket.IO realtime listener
  useEffect(() => {
    if (!sessionId) return;

    console.log(`[QRAttendance] Registering socket listener for session: ${sessionId}`);
    const unsubscribe = socketService.on("qr-attendance:checkin", (data: any) => {
      if (data.sessionId === sessionId) {
        setCheckedInMap((prev) => {
          const next = new Map(prev);
          next.set(data.studentId, { checkinAt: data.checkinAt });
          return next;
        });

        // Kích hoạt animation highlight cho học viên vừa checkin
        setNewlyCheckedInId(data.studentId);
        if (newlyCheckedInTimeoutRef.current) {
          clearTimeout(newlyCheckedInTimeoutRef.current);
        }
        newlyCheckedInTimeoutRef.current = setTimeout(() => {
          setNewlyCheckedInId(null);
        }, 3000); // Highlight trong 3s
      }
    });

    return () => {
      unsubscribe();
      if (newlyCheckedInTimeoutRef.current) {
        clearTimeout(newlyCheckedInTimeoutRef.current);
      }
    };
  }, [sessionId]);

  // 4. Polling trạng thái (để làm fallback dự phòng) và Polling xoay Token
  useEffect(() => {
    if (!sessionId) return;

    // Polling status mỗi 5s
    const statusInterval = setInterval(async () => {
      try {
        const res = await apiFetch(`/qr-attendance/session/${sessionId}/status`);
        if (res.students) {
          setCheckedInMap((prev) => {
            const next = new Map(prev);
            res.students.forEach((student: any) => {
              if (student.checkedIn) {
                next.set(student.studentId, { checkinAt: student.checkinAt || Date.now() });
              }
            });
            return next;
          });
        }
        if (res.closed) {
          toast.info("Phiên điểm danh đã kết thúc.");
          handleCloseAndSave();
        }
      } catch (err) {
        console.warn("Polling session status error:", err);
      }
    }, 5000);

    // Polling token mỗi 25s để tự xoay trước khi token hết hạn hoàn toàn
    const tokenInterval = setInterval(async () => {
      try {
        const res = await apiFetch(`/qr-attendance/session/${sessionId}/token`);
        if (res.token) {
          setQrToken(res.token);
          setTokenExpiresAt(res.tokenExpiresAt);
          setExpiresAt(res.sessionExpiresAt);
          setTokenTimeRemaining(30);
        }
      } catch (err) {
        console.warn("Rotate token error:", err);
      }
    }, 25000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(tokenInterval);
    };
  }, [sessionId]);

  // 5. Timer đếm ngược (cho cả 5 phút và 30s xoay QR)
  useEffect(() => {
    if (loading || !sessionId || !expiresAt || !tokenExpiresAt) return;

    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();

      // Đếm ngược 5 phút dựa trên expiresAt thực tế
      const remainingSecs = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remainingSecs);

      if (remainingSecs <= 0) {
        clearInterval(countdownIntervalRef.current!);
        toast.info("Đã hết thời gian điểm danh.");
        handleCloseAndSave();
      }

      // Đếm ngược 30s xoay QR dựa trên tokenExpiresAt thực tế
      const tokenRemainingSecs = Math.max(0, Math.floor((tokenExpiresAt - now) / 1000));
      setTokenTimeRemaining(tokenRemainingSecs);
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [loading, sessionId, expiresAt, tokenExpiresAt]);

  // 6. Đóng phiên điểm danh và lưu kết quả vào DB
  const handleCloseAndSave = async () => {
    if (!sessionId || closing) return;
    try {
      setClosing(true);
      await apiFetch(`/qr-attendance/session/${sessionId}/close`, {
        method: "POST",
      });
      toast.success("Điểm danh thành công. Đã lưu kết quả.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra khi lưu kết quả điểm danh.");
      setClosing(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy phiên điểm danh QR này? Kết quả quét từ học viên từ đầu phiên sẽ KHÔNG được lưu.")) {
      onClose();
    }
  };

  // Lọc ra các học viên trong lớp
  const classStudents = students.filter((s) => batch.learnerIds.includes(s.id));
  const checkedInCount = classStudents.filter((s) => checkedInMap.has(s.id)).length;
  const totalCount = classStudents.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                QR
              </span>
              <h3 className="text-base font-black text-slate-800 tracking-tight">Điểm danh lớp {batch.code}</h3>
            </div>
            <p className="text-xs text-slate-500 font-semibold">
              {batch.courseTitle} • Ngày {formatDate(date)}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
          {loading ? (
            <div className="col-span-12 flex flex-col justify-center items-center py-16">
              <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                Đang khởi tạo phiên QR...
              </p>
            </div>
          ) : (
            <>
              {/* Left Column: QR Code & Status Info */}
              <div className="md:col-span-5 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6 space-y-6">
                <div className="w-full text-center space-y-4">
                  {/* Countdown Timer */}
                  <div className="inline-flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 shadow-sm">
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Phiên đóng sau
                      </div>
                      <div className="text-2xl font-black text-slate-800 tracking-tight">
                        {formatTime(timeRemaining)}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Đã điểm danh
                      </div>
                      <div className="text-2xl font-black text-brand-primary tracking-tight">
                        {checkedInCount} <span className="text-slate-400 text-sm font-bold">/ {totalCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Image Frame */}
                  <div className="relative bg-white border-2 border-slate-100 p-3 rounded-2xl shadow-lg max-w-[280px] mx-auto overflow-hidden group">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Code" className="w-60 h-60 mx-auto transition-transform group-hover:scale-102" />
                    ) : (
                      <div className="w-60 h-60 bg-slate-50 flex items-center justify-center rounded-xl">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                      </div>
                    )}

                    {/* Rotating Indicator */}
                    <div className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="bg-slate-900/90 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase shadow-md inline-flex items-center gap-1.5 backdrop-blur-sm border border-white/10">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                        Xoay sau {tokenTimeRemaining}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-500 space-y-2.5 max-w-[285px] w-full shadow-inner">
                  <div className="flex items-start gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">1</span>
                    <p>Học viên mở camera điện thoại quét mã QR.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">2</span>
                    <p>Mở đường dẫn và nhập Số điện thoại để điểm danh.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold">3</span>
                    <p>Trạng thái sẽ tự động cập nhật bên phải.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Student List */}
              <div className="md:col-span-7 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-3 shrink-0">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" /> Danh sách buổi học
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Sĩ số: {totalCount}
                  </span>
                </div>

                {/* List Container */}
                <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100/60 overflow-y-auto flex-1 min-h-[250px] shadow-sm">
                  {classStudents.length === 0 ? (
                    <div className="text-center py-12">
                      <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-bold">Không có học viên nào trong lớp này.</p>
                    </div>
                  ) : (
                    classStudents.map((student) => {
                      const checkinData = checkedInMap.get(student.id);
                      const isChecked = !!checkinData;
                      const isNew = newlyCheckedInId === student.id;

                      return (
                        <div
                          key={student.id}
                          className={cn(
                            "flex items-center justify-between py-3 px-4 transition-all duration-700",
                            isNew && "bg-emerald-500/15 border-emerald-500/20 scale-101 shadow-md z-10",
                            isChecked && !isNew && "bg-emerald-500/5"
                          )}
                        >
                          <div className="space-y-0.5">
                            <p className={cn(
                              "text-xs font-bold text-slate-700 transition-colors",
                              isChecked && "text-emerald-700 font-extrabold"
                            )}>
                              {student.fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold">{student.phone}</p>
                          </div>

                          <div>
                            {isChecked ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-semibold">
                                  {new Date(checkinData.checkinAt).toLocaleTimeString("vi-VN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 rounded-full p-1 flex items-center justify-center shadow-sm">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded-full">
                                Chưa quét
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={closing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            Hủy bỏ phiên
          </button>

          <button
            type="button"
            onClick={handleCloseAndSave}
            disabled={closing || loading}
            className="px-4.5 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-black shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {closing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white/80 animate-pulse" />
                Đóng phiên &amp; Lưu điểm danh
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
