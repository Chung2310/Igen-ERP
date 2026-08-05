import React from "react";
import type { Worker } from "../types";
import { workerDashboardApi } from "../api/workerDashboard.api";

export function WorkerDashboardPage({ formattedDate, onSelectStudent, onSelectWorker, selectedCenter }: { formattedDate: string; onSelectStudent?: (worker: Worker) => void; onSelectWorker?: (worker: Worker) => void; onNavigate?: (view: string) => void; selectedCenter?: string }) {
  const [stats, setStats] = React.useState({ totalWorkers: 0, activeWorkers: 0, projects: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const select = onSelectWorker || onSelectStudent;
  React.useEffect(() => { if (!selectedCenter || selectedCenter === "all") return; let active = true; setLoading(true); void workerDashboardApi.get(selectedCenter).then((value) => { if (active) setStats(value); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Không thể tải dashboard"); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [selectedCenter]);
  return <div className="flex flex-col gap-5 text-left"><section><h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1><p className="mt-1 text-xs font-medium text-slate-400">Hôm nay: {formattedDate}</p></section>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<section className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-500">Tổng lao động</p><p className="mt-2 text-3xl font-black text-cyan-700">{loading ? "—" : stats.totalWorkers}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-500">Đang hoạt động</p><p className="mt-2 text-3xl font-black text-emerald-600">{loading ? "—" : stats.activeWorkers}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-500">Dự án</p><p className="mt-2 text-3xl font-black text-violet-600">{loading ? "—" : stats.projects}</p></div></section>{select && <button type="button" onClick={() => select({ _id: "", fullName: "", status: "active" })} className="w-fit text-xs font-bold text-cyan-700">Mở hồ sơ lao động</button>}</div>;
}
