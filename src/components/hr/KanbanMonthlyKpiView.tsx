import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";

type KpiRow = {
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percent: number | null;
};
type Report = { periodKey: string; periodStatus: "provisional" | "closed"; closedAt: string | null; rows: KpiRow[] };

const localPeriod = () => {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
};

const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

function KpiMonthPicker({ value, max, onChange }: { value: string; max: string; onChange: (value: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [position, setPosition] = useState({ top: 0, left: 0, width: 272 });
  const selectedMonth = Number(value.slice(5, 7));
  const maxYear = Number(max.slice(0, 4));

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(272, window.innerWidth - 24);
      const height = popoverRef.current?.getBoundingClientRect().height || 250;
      const placeAbove = window.innerHeight - bounds.bottom < height + 12 && bounds.top > height;
      setPosition({
        top: Math.max(12, Math.min(placeAbove ? bounds.top - height - 6 : bounds.bottom + 6, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)),
        width,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="flex items-center gap-2 text-sm text-slate-700">
    <span>Tháng</span>
    <button
      ref={triggerRef}
      type="button"
      aria-label="Chọn tháng KPI"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => { setYear(Number(value.slice(0, 4))); setOpen((current) => !current); }}
      className="flex h-10 min-w-36 items-center justify-between gap-2 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm font-normal text-slate-700 outline-none transition-colors hover:border-[#B8E8FF] focus-visible:ring-2 focus-visible:ring-[#00ADFC]/20"
    >
      <span>{months[selectedMonth - 1]} {value.slice(0, 4)}</span>
      <CalendarDays className="h-4 w-4 shrink-0 text-[#007EB8]" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={popoverRef} role="dialog" aria-label="Lịch chọn tháng KPI" className="fixed z-[200] rounded-2xl border border-[#DCE7F4] bg-white p-3 text-slate-800 shadow-[0_18px_50px_rgba(13,48,78,0.18)]" style={position}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm">Năm {year}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Năm trước" onClick={() => setYear((current) => current - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#E8F7FF]"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Năm sau" disabled={year >= maxYear} onClick={() => setYear((current) => current + 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#E8F7FF] disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {months.map((month, index) => {
            const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`;
            return <button key={month} type="button" aria-label={`Chọn ${month} năm ${year}`} aria-pressed={monthValue === value} disabled={monthValue > max} onClick={() => { onChange(monthValue); setOpen(false); triggerRef.current?.focus(); }} className={`rounded-lg px-2 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${monthValue === value ? "bg-[#00ADFC] text-white" : "text-slate-700 hover:bg-[#E8F7FF]"}`}>{month}</button>;
          })}
        </div>
        <div className="mt-3 border-t border-[#E8F0F8] pt-2 text-right">
          <button type="button" onClick={() => { onChange(max); setOpen(false); triggerRef.current?.focus(); }} className="rounded-lg px-2 py-1 text-xs text-[#007EB8] hover:bg-[#E8F7FF]">Tháng này</button>
        </div>
      </div>, document.body,
    )}
  </div>;
}

export default function KanbanMonthlyKpiView({ activeBranchId, initialPeriod }: { activeBranchId?: string; initialPeriod?: string }) {
  const [period, setPeriod] = useState(initialPeriod || localPeriod());
  const [report, setReport] = useState<Report>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ period });
    if (activeBranchId) query.set("branchId", activeBranchId);
    void fetch(`/api/v1/kanban/kpi/monthly?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    }).then(async (response) => {
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "Không tải được KPI tháng.");
      if (active) setReport(json.data);
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : "Không tải được KPI tháng.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, activeBranchId]);

  return (
    <section className="space-y-4" aria-label="KPI công việc theo tháng">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#DCE7F4] bg-[#F8FCFF] p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-slate-900">KPI công việc theo tháng</h3>
            {report && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${report.periodStatus === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{report.periodStatus === "closed" ? "Đã chốt" : "Tạm tính"}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Số công việc hoàn thành đúng hạn trên tổng công việc đến hạn trong tháng.</p>
        </div>
        <KpiMonthPicker value={period} max={localPeriod()} onChange={setPeriod} />
      </div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải KPI...</p> : (
        <div className="overflow-x-auto rounded-2xl border border-[#DCE7F4]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F5FAFE] text-slate-600 font-medium"><tr><th className="p-3 font-medium">Nhân viên</th><th className="p-3 text-center font-medium">Đúng hạn</th><th className="p-3 text-center font-medium">Tổng công việc</th><th className="p-3 text-center font-medium">Chưa đạt KPI</th><th className="min-w-48 p-3 font-medium">KPI</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {report?.rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="p-3 font-medium text-slate-800">{row.employeeName}</td>
                  <td className="p-3 text-center text-emerald-700">{row.completedTasks}</td>
                  <td className="p-3 text-center">{row.totalTasks}</td>
                  <td className="p-3 text-center text-amber-700">{row.pendingTasks}</td>
                  <td className="p-3">{row.percent === null ? <span className="text-slate-400">Chưa có công việc</span> : <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8F7FF]"><div className="h-full rounded-full bg-[#00ADFC]" style={{ width: `${row.percent}%` }} /></div><span>{row.percent.toLocaleString("vi-VN")}%</span></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report?.rows.length && <p className="p-8 text-center text-sm text-slate-500">Chưa có nhân viên trong phạm vi này.</p>}
        </div>
      )}
    </section>
  );
}
