import React from "react";
import { ApiClientError } from "../../../services/apiClientError";

type ShiftScheduleDetails = {
  reason: "non_working_day" | "before_shift" | "after_shift";
  workDate: string;
  workShiftCode: string;
  workShiftName: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

const HEADLINE: Record<ShiftScheduleDetails["reason"], string> = {
  non_working_day: "Hôm nay không phải ngày làm việc của bạn",
  before_shift: "Chưa đến giờ làm việc của bạn",
  after_shift: "Đã hết giờ làm việc của bạn",
};

const clock = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
const time = (value?: string) => (value ? clock.format(new Date(value)) : undefined);

function scheduleDetails(error: unknown): ShiftScheduleDetails | null {
  if (!(error instanceof ApiClientError) || error.code !== "SHIFT_OUTSIDE_WORK_SCHEDULE") return null;
  const details = error.details as Partial<ShiftScheduleDetails> | undefined;
  if (!details?.reason || !details.workShiftName) return null;
  return details as ShiftScheduleDetails;
}

/**
 * Lỗi lịch làm việc là lỗi cấu hình, không phải lỗi thao tác: thu ngân chỉ xử lý được
 * khi biết ca nào đang áp dụng và khung giờ ra sao. Vì vậy hiển thị ngay trong khối mở ca
 * dưới dạng hướng dẫn, không dùng popup và không đổ nguyên văn thông báo của máy chủ.
 */
export function ShiftScheduleNotice({ error }: { error: unknown }) {
  if (!error) return null;
  const details = scheduleDetails(error);

  if (!details) {
    return (
      <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {error instanceof Error ? error.message : "Không thể mở ca bán hàng."}
      </p>
    );
  }

  const start = time(details.scheduledStartAt);
  const end = time(details.scheduledEndAt);
  return (
    <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-white p-4 text-left">
      <p className="text-sm font-bold text-amber-900">{HEADLINE[details.reason]}</p>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-700">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Ca áp dụng</dt>
          <dd className="font-semibold">{details.workShiftName} ({details.workShiftCode})</dd>
        </div>
        {start && end && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Khung giờ</dt>
            <dd className="font-semibold">{start} – {end}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-sm text-slate-600">
        {details.reason === "before_shift" && start
          ? `Bạn có thể mở ca bán hàng từ ${start}.`
          : "Liên hệ quản lý nếu lịch làm việc này chưa đúng."}
      </p>
    </div>
  );
}
