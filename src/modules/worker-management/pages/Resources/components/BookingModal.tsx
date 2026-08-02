import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  Warehouse,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { apiFetch } from "../../../lib/api";
import { toast } from "../../../../../pages/Toast";
import { ResourceItem } from "../../../types";
import {
  ErpModal,
  ErpField,
  ErpInput,
  ErpSubmitButton,
  erpInputClass,
} from "../../../components/Erp/ErpUI";
import { TimeInput24 } from "../../../../../components/common/TimeInput24";
import { todayStr, getTypeColor } from "../utils";

interface BookingModalProps {
  bookingResource: ResourceItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingModal({
  bookingResource,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const darkMode = false;

  const [newBooking, setNewBooking] = useState({
    purpose: "",
    by: "",
    date: todayStr(),
    startTime: "08:00",
    endTime: "11:30",
  });

  // Reset form when resource changes
  useEffect(() => {
    if (bookingResource) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewBooking({
        purpose: "",
        by: "",
        date: todayStr(),
        startTime: "08:00",
        endTime: "11:30",
      });
    }
  }, [bookingResource]);

  const isTimeInvalid = useMemo(() => {
    if (!newBooking.startTime || !newBooking.endTime) return false;
    return newBooking.startTime >= newBooking.endTime;
  }, [newBooking.startTime, newBooking.endTime]);

  const isDateInPast = useMemo(() => {
    if (!newBooking.date) return false;
    const today = todayStr();
    return newBooking.date < today;
  }, [newBooking.date]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingResource) return;
    if (
      !newBooking.purpose ||
      !newBooking.by ||
      !newBooking.date ||
      !newBooking.startTime ||
      !newBooking.endTime
    ) {
      toast.error("Vui lòng nhập đầy đủ thông tin đặt lịch.");
      return;
    }
    if (isTimeInvalid) {
      toast.error("Giờ kết thúc phải sau giờ bắt đầu sử dụng.");
      return;
    }
    if (isDateInPast) {
      toast.error("Không thể đăng ký đặt mượn trong quá khứ.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/student-resources/${bookingResource.id}/bookings`, {
        method: "POST",
        body: JSON.stringify(newBooking),
      });
      toast.success("Đã đặt lịch sử dụng tài nguyên thành công!");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Có lỗi xảy ra khi đặt lịch.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bookingResource) return null;

  return (
    <ErpModal title={`Đặt mượn: ${bookingResource.name}`} onClose={onClose}>
      <form onSubmit={handleBook} className="space-y-4">
        {/* Resource Info Card */}
        <div
          className={cn(
            "flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all duration-300",
            darkMode
              ? "bg-slate-800/40 border-slate-700/60"
              : "bg-slate-50 border-slate-200/60",
          )}
        >
          <div className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  darkMode ? "text-slate-400" : "text-slate-550",
                )}
              >
                {bookingResource.identifier}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                  getTypeColor(bookingResource.type),
                )}
              >
                {bookingResource.type}
              </span>
            </div>
            <h4
              className={cn(
                "text-xs font-black",
                darkMode ? "text-slate-100" : "text-slate-800",
              )}
            >
              {bookingResource.name}
            </h4>
            <p className={cn("text-[10px] font-bold text-slate-500")}>
              Khả năng đáp ứng:{" "}
              <span className="font-black text-slate-700">
                {bookingResource.capacity}
              </span>
            </p>
          </div>
          <div
            className={cn(
              "p-3 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
              darkMode
                ? "bg-slate-850 text-brand-primary/80"
                : "bg-white border border-slate-150 text-brand-primary",
            )}
          >
            <Warehouse className="w-5 h-5" />
          </div>
        </div>

        <ErpField label="Mục đích sử dụng">
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
              <FileText className="w-4 h-4" />
            </div>
            <ErpInput
              type="text"
              required
              placeholder="Ví dụ: Dạy lớp Kỹ năng mềm - Phòng 301"
              value={newBooking.purpose}
              onChange={(e) =>
                setNewBooking({ ...newBooking, purpose: e.target.value })
              }
              className="pl-11 pr-4 focus:ring-4 focus:ring-brand-primary/5 transition-all"
            />
          </div>
        </ErpField>

        <ErpField label="Người đăng ký">
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
              <User className="w-4 h-4" />
            </div>
            <ErpInput
              type="text"
              required
              placeholder="Ví dụ: Thầy Cường"
              value={newBooking.by}
              onChange={(e) =>
                setNewBooking({ ...newBooking, by: e.target.value })
              }
              className="pl-11 pr-4 focus:ring-4 focus:ring-brand-primary/5 transition-all"
            />
          </div>
        </ErpField>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ErpField label="Ngày sử dụng">
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
                <Calendar className="w-4 h-4" />
              </div>
              <ErpInput
                type="date"
                required
                value={newBooking.date}
                onChange={(e) =>
                  setNewBooking({ ...newBooking, date: e.target.value })
                }
                className={cn(
                  "pl-11 pr-3 focus:ring-4 focus:ring-brand-primary/5 transition-all w-full",
                  isDateInPast &&
                    "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10 bg-rose-50/20",
                )}
              />
            </div>
          </ErpField>

          <ErpField label="Từ giờ">
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
                <Clock className="w-4 h-4" />
              </div>
              <TimeInput24
                required
                value={newBooking.startTime}
                onChange={(v) => setNewBooking({ ...newBooking, startTime: v })}
                className={cn(
                  erpInputClass(darkMode),
                  "pl-11 pr-3 focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all w-full",
                  isTimeInvalid &&
                    "border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-500/10 bg-rose-50/20",
                )}
              />
            </div>
          </ErpField>

          <ErpField label="Đến giờ">
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
                <Clock className="w-4 h-4" />
              </div>
              <TimeInput24
                required
                value={newBooking.endTime}
                onChange={(v) => setNewBooking({ ...newBooking, endTime: v })}
                className={cn(
                  erpInputClass(darkMode),
                  "pl-11 pr-3 focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all w-full",
                  isTimeInvalid &&
                    "border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-500/10 bg-rose-50/20",
                )}
              />
            </div>
          </ErpField>
        </div>

        {/* Validation alerts */}
        {isTimeInvalid && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-100 bg-rose-50/80 text-[10px] font-bold text-rose-600 transition-all duration-300">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="font-extrabold uppercase tracking-wider text-[9px]">
                Lỗi chọn giờ
              </p>
              <p className="text-rose-550/90 font-medium">
                Giờ kết thúc phải sau giờ bắt đầu sử dụng.
              </p>
            </div>
          </div>
        )}

        {isDateInPast && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-100 bg-rose-50/80 text-[10px] font-bold text-rose-600 transition-all duration-300">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="font-extrabold uppercase tracking-wider text-[9px]">
                Lỗi chọn ngày
              </p>
              <p className="text-rose-550/90 font-medium">
                Không thể đăng ký đặt mượn trong quá khứ.
              </p>
            </div>
          </div>
        )}

        <ErpSubmitButton
          disabled={isSubmitting || isTimeInvalid || isDateInPast}
        >
          {isSubmitting
            ? "Đang đặt lịch..."
            : isTimeInvalid || isDateInPast
              ? "Thông tin chưa hợp lệ"
              : "Xác nhận đặt lịch"}
        </ErpSubmitButton>
      </form>
    </ErpModal>
  );
}
