import React from "react";
import type { Worker, WorkerAttendanceLog } from "../types";
import { workerAttendanceApi } from "../api/workerAttendance.api";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

export function WorkerTimekeepingPanel({ projectId, workers, canManage = true }: { projectId: string; workers: Worker[]; canManage?: boolean }) {
  const [logs, setLogs] = React.useState<WorkerAttendanceLog[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const reload = React.useCallback(async () => { setLoading(true); setError(""); try { setLogs(await workerAttendanceApi.list(projectId)); } catch (e) { setError(getApiErrorMessage(e, "Không thể tải chấm công")); } finally { setLoading(false); } }, [projectId]);
  React.useEffect(() => { void reload(); }, [reload]);
  const mark = async (workerId: string) => { try { await workerAttendanceApi.mark({ projectId, workerId }); await reload(); } catch (e) { setError(getApiErrorMessage(e, "Không thể chấm công")); } };
  return <section aria-label="worker-timekeeping" className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">Chấm công lao động</h2><button type="button" onClick={() => void reload()} disabled={loading} className="text-xs font-bold text-cyan-700">{loading ? "Đang tải..." : "Làm mới"}</button></div>{error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}<div className="grid gap-2">{workers.map((worker) => { const log = logs.find((item) => item.workerId === worker._id); return <div key={worker._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-sm font-semibold">{worker.fullName}</span>{canManage && <button type="button" onClick={() => void mark(worker._id)} className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white">{log?.checkIn ? "Ghi nhận tiếp" : "Check-in"}</button>}</div>; })}</div></section>;
}
