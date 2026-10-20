import React, { useEffect, useState } from "react";
import { DateInput24 } from "../common/TimeInput24";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Home, LogIn, LogOut, MapPin, ScanFace, ShieldAlert, UserCheck, Users, WifiOff } from "lucide-react";
import {
  attendanceOverviewCategories,
  attendanceOverviewLabels,
  attendanceErrorLabels,
  type AttendanceErrorCategory,
  type AttendanceDailyOverviewResult,
  type AttendanceOverviewFilter,
} from "../../utils/attendanceDailyOverview";

interface AttendanceDailyOverviewProps {
  date: string;
  onDateChange: (date: string) => void;
  result: AttendanceDailyOverviewResult;
  loading: boolean;
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftDate = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
};

const metricStyles: Record<AttendanceOverviewFilter, { icon: React.ElementType; active: string; iconBg: string }> = {
  all: { icon: Users, active: "bg-[#e8f7ff] border-[#8edcff]", iconBg: "bg-[#e8f7ff] text-[#008dcc]" },
  on_time: { icon: UserCheck, active: "border-emerald-600 ring-emerald-100", iconBg: "bg-emerald-50 text-emerald-700" },
  late: { icon: LogIn, active: "border-amber-500 ring-amber-100", iconBg: "bg-amber-50 text-amber-700" },
  early: { icon: LogOut, active: "border-orange-500 ring-orange-100", iconBg: "bg-orange-50 text-orange-700" },
  late_early: { icon: Clock3, active: "border-rose-500 ring-rose-100", iconBg: "bg-rose-50 text-rose-700" },
  leave: { icon: CalendarDays, active: "bg-[#e8f7ff] border-[#8edcff]", iconBg: "bg-[#e8f7ff] text-[#008dcc]" },
  wfh: { icon: Home, active: "bg-[#e8f7ff] border-[#8edcff]", iconBg: "bg-[#e8f7ff] text-[#008dcc]" },
  absent: { icon: ShieldAlert, active: "border-red-600 ring-red-100", iconBg: "bg-red-50 text-red-700" },
  incomplete: { icon: Clock3, active: "bg-amber-50 border-amber-200", iconBg: "bg-amber-50 text-amber-700" },
};

export default function AttendanceDailyOverview({ date, onDateChange, result, loading }: AttendanceDailyOverviewProps) {
  const [selected, setSelected] = useState<AttendanceOverviewFilter>("all");
  const [selectedError, setSelectedError] = useState<AttendanceErrorCategory | null>(null);
  useEffect(() => { setSelected("all"); setSelectedError(null); }, [date]);

  const metrics: AttendanceOverviewFilter[] = ["all", ...attendanceOverviewCategories];
  const visibleEmployees = selected === "all" ? result.all : result.groups[selected];

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f8fbff] p-4 md:p-5">
      <div className="mx-auto flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#dce7f4] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-normal text-slate-800">Tổng quan chấm công chi nhánh</h2>
            <p className="mt-0.5 text-xs font-normal text-slate-500">Tình hình nhân sự theo ngày được chọn</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Ngày trước" onClick={() => onDateChange(shiftDate(date, -1))} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] hover:bg-[#d7f1ff] cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <DateInput24 value={date} onChange={(value) => value && onDateChange(value)} required ariaLabel="Ngày tổng quan" className="!min-h-9 !w-36 !rounded-lg !px-1.5 text-xs" />
            <button type="button" aria-label="Ngày sau" onClick={() => onDateChange(shiftDate(date, 1))} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] hover:bg-[#d7f1ff] cursor-pointer">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            Đang tải dữ liệu chấm công...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {metrics.map((category) => {
                const style = metricStyles[category];
                const Icon = style.icon;
                const active = selected === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-label={`${attendanceOverviewLabels[category]}: ${result.counts[category]}`}
                    onClick={() => setSelected(active && category !== "all" ? "all" : category)}
                    className={`flex min-h-20 items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer hover:border-[#8edcff] hover:bg-[#f4fbff] ${active ? style.active : "border-[#dce7f4] bg-white"}`}
                  >
                    <div>
                      <div className="text-xs font-normal text-slate-600">{attendanceOverviewLabels[category]}</div>
                      <div className="mt-1 text-xl font-normal text-slate-800">{result.counts[category]}</div>
                    </div>
                    <span className={`rounded-xl p-2 ${style.iconBg}`}><Icon className="h-4 w-4" /></span>
                  </button>
                );
              })}
            </div>

            <section>
              <h3 className="mb-3 text-sm font-normal text-slate-800">Lỗi chấm công</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {(["location", "network", "face", "forgot_checkin", "forgot_checkout"] as AttendanceErrorCategory[]).map((category) => {
                  const Icon = category === "location" ? MapPin : category === "network" ? WifiOff : category === "face" ? ScanFace : AlertTriangle;
                  return <button key={category} type="button" aria-label={`${attendanceErrorLabels[category]}: ${result.errorCounts[category]}`} onClick={() => setSelectedError(selectedError === category ? null : category)} className={`flex min-h-20 items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer hover:border-rose-200 hover:bg-rose-50/40 ${selectedError === category ? "border-rose-300 bg-rose-50" : "border-[#dce7f4] bg-white"}`}><div><div className="text-xs font-normal text-slate-600">{attendanceErrorLabels[category]}</div><div className="mt-1 text-xl font-normal text-slate-800">{result.errorCounts[category]}</div></div><span className="rounded-xl bg-rose-50 p-2 text-rose-600"><Icon className="h-4 w-4" /></span></button>;
                })}
              </div>
              {selectedError && <div className="mt-3 overflow-hidden rounded-2xl border border-[#dce7f4] bg-white">{result.errors[selectedError].length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Không có lỗi thuộc nhóm này.</div> : result.errors[selectedError].map((item) => <div key={item.uid} className="grid gap-2 border-b border-[#edf3f9] px-4 py-3 text-xs md:grid-cols-[1fr_120px_160px_120px]"><div><span className="text-slate-800">{item.displayName || "Nhân viên iGen"}</span><div className="text-slate-500">{item.email}</div></div><span>{item.action === "check-in" ? "Check-in" : "Check-out"}</span><span>{item.attemptedAt ? new Date(item.attemptedAt).toLocaleString("vi-VN") : "—"}</span><span className="text-rose-600">{item.attemptCount ? `${item.attemptCount} lần thử` : attendanceErrorLabels[selectedError]}</span></div>)}</div>}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#dce7f4] bg-white">
              <div className="border-b border-[#e5eef8] bg-[#f3faff] px-4 py-3">
                <h3 className="text-sm font-normal text-slate-800">{attendanceOverviewLabels[selected]}</h3>
                <p className="text-[11px] text-slate-500">{visibleEmployees.length} nhân viên</p>
              </div>
              {visibleEmployees.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm font-normal text-slate-400">Không có nhân viên phù hợp.</div>
              ) : (
                <div className="divide-y divide-[#edf3f9]">
                  {visibleEmployees.map((employee) => (
                    <div key={employee.uid} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(220px,1fr)_160px_110px_110px]">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-normal text-slate-800">{employee.displayName || "Nhân viên iGen"}</div>
                        <div className="truncate text-[11px] text-slate-500">{employee.email || "—"}</div>
                      </div>
                      <span className="justify-self-end rounded-lg bg-[#e8f7ff] px-2 py-1 text-[10px] font-normal text-[#008dcc] md:justify-self-start">{employee.status}</span>
                      <div className="hidden text-xs font-mono text-slate-600 md:block"><span className="mr-1 text-slate-400">Vào</span>{employee.checkIn}</div>
                      <div className="hidden text-xs font-mono text-slate-600 md:block"><span className="mr-1 text-slate-400">Ra</span>{employee.checkOut}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
