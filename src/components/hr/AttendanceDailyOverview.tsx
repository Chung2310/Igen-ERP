import React, { useEffect, useState } from "react";
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
  all: { icon: Users, active: "border-slate-700 ring-slate-200", iconBg: "bg-slate-100 text-slate-700" },
  on_time: { icon: UserCheck, active: "border-emerald-600 ring-emerald-100", iconBg: "bg-emerald-50 text-emerald-700" },
  late: { icon: LogIn, active: "border-amber-500 ring-amber-100", iconBg: "bg-amber-50 text-amber-700" },
  early: { icon: LogOut, active: "border-orange-500 ring-orange-100", iconBg: "bg-orange-50 text-orange-700" },
  late_early: { icon: Clock3, active: "border-rose-500 ring-rose-100", iconBg: "bg-rose-50 text-rose-700" },
  leave: { icon: CalendarDays, active: "border-blue-500 ring-blue-100", iconBg: "bg-blue-50 text-blue-700" },
  wfh: { icon: Home, active: "border-cyan-500 ring-cyan-100", iconBg: "bg-cyan-50 text-cyan-700" },
  absent: { icon: ShieldAlert, active: "border-red-600 ring-red-100", iconBg: "bg-red-50 text-red-700" },
  incomplete: { icon: Clock3, active: "border-violet-500 ring-violet-100", iconBg: "bg-violet-50 text-violet-700" },
};

export default function AttendanceDailyOverview({ date, onDateChange, result, loading }: AttendanceDailyOverviewProps) {
  const [selected, setSelected] = useState<AttendanceOverviewFilter>("all");
  const [selectedError, setSelectedError] = useState<AttendanceErrorCategory | null>(null);
  useEffect(() => { setSelected("all"); setSelectedError(null); }, [date]);

  const metrics: AttendanceOverviewFilter[] = ["all", ...attendanceOverviewCategories];
  const visibleEmployees = selected === "all" ? result.all : result.groups[selected];

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-black text-slate-800">Tổng quan chấm công chi nhánh</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Tình hình nhân sự theo ngày được chọn</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" aria-label="Ngày trước" onClick={() => onDateChange(shiftDate(date, -1))} className="rounded-lg p-2 text-slate-600 hover:bg-white cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input aria-label="Ngày tổng quan" type="date" value={date} onChange={(event) => event.target.value && onDateChange(event.target.value)} className="bg-transparent px-2 py-1 text-xs font-bold text-slate-700 outline-none" />
            <button type="button" aria-label="Ngày sau" onClick={() => onDateChange(shiftDate(date, 1))} className="rounded-lg p-2 text-slate-600 hover:bg-white cursor-pointer">
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
                    className={`flex items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${active ? `${style.active} ring-2` : "border-slate-200"}`}
                  >
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{attendanceOverviewLabels[category]}</div>
                      <div className="mt-1 text-2xl font-black text-slate-800">{result.counts[category]}</div>
                    </div>
                    <span className={`rounded-xl p-2 ${style.iconBg}`}><Icon className="h-5 w-5" /></span>
                  </button>
                );
              })}
            </div>

            <section>
              <h3 className="mb-3 text-sm font-black text-slate-800">Lỗi chấm công</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {(["location", "network", "face", "forgot_checkin", "forgot_checkout"] as AttendanceErrorCategory[]).map((category) => {
                  const Icon = category === "location" ? MapPin : category === "network" ? WifiOff : category === "face" ? ScanFace : AlertTriangle;
                  return <button key={category} type="button" aria-label={`${attendanceErrorLabels[category]}: ${result.errorCounts[category]}`} onClick={() => setSelectedError(selectedError === category ? null : category)} className={`flex items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm cursor-pointer ${selectedError === category ? "border-red-500 ring-2 ring-red-100" : "border-slate-200"}`}><div><div className="text-[10px] font-extrabold uppercase text-slate-500">{attendanceErrorLabels[category]}</div><div className="mt-1 text-2xl font-black text-slate-800">{result.errorCounts[category]}</div></div><span className="rounded-xl bg-red-50 p-2 text-red-600"><Icon className="h-5 w-5" /></span></button>;
                })}
              </div>
              {selectedError && <div className="mt-3 overflow-hidden rounded-2xl border border-red-100 bg-white">{result.errors[selectedError].length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Không có lỗi thuộc nhóm này.</div> : result.errors[selectedError].map((item) => <div key={item.uid} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-xs md:grid-cols-[1fr_120px_160px_120px]"><div><b className="text-slate-800">{item.displayName || "Nhân viên iGen"}</b><div className="text-slate-500">{item.email}</div></div><span>{item.action === "check-in" ? "Check-in" : "Check-out"}</span><span>{item.attemptedAt ? new Date(item.attemptedAt).toLocaleString("vi-VN") : "—"}</span><span className="font-bold text-red-600">{item.attemptCount ? `${item.attemptCount} lần thử` : attendanceErrorLabels[selectedError]}</span></div>)}</div>}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-black text-slate-800">{attendanceOverviewLabels[selected]}</h3>
                <p className="text-[11px] text-slate-500">{visibleEmployees.length} nhân viên</p>
              </div>
              {visibleEmployees.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm font-medium text-slate-400">Không có nhân viên phù hợp.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleEmployees.map((employee) => (
                    <div key={employee.uid} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(220px,1fr)_160px_110px_110px]">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-800">{employee.displayName || "Nhân viên iGen"}</div>
                        <div className="truncate text-[11px] text-slate-500">{employee.email || "—"}</div>
                      </div>
                      <span className="justify-self-end rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 md:justify-self-start">{employee.status}</span>
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
