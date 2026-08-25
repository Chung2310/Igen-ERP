import React, { useEffect, useState } from "react";
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
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">KPI công việc theo tháng</h3>
            {report && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${report.periodStatus === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{report.periodStatus === "closed" ? "Đã chốt" : "Tạm tính"}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Số công việc hoàn thành trên tổng công việc đến hạn trong tháng.</p>
        </div>
        <label className="text-sm font-semibold text-slate-700">Tháng
          <input aria-label="Chọn tháng KPI" type="month" value={period} max={localPeriod()} onChange={(event) => setPeriod(event.target.value)} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal" />
        </label>
      </div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải KPI...</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Nhân viên</th><th className="p-3 text-center">Hoàn thành</th><th className="p-3 text-center">Tổng công việc</th><th className="p-3 text-center">Chưa hoàn thành</th><th className="min-w-48 p-3">KPI</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {report?.rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="p-3 font-semibold text-slate-800">{row.employeeName}</td>
                  <td className="p-3 text-center text-emerald-700">{row.completedTasks}</td>
                  <td className="p-3 text-center font-bold">{row.totalTasks}</td>
                  <td className="p-3 text-center text-amber-700">{row.pendingTasks}</td>
                  <td className="p-3">{row.percent === null ? <span className="text-slate-400">Chưa có công việc</span> : <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${row.percent}%` }} /></div><b>{row.percent.toLocaleString("vi-VN")}%</b></div>}</td>
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
