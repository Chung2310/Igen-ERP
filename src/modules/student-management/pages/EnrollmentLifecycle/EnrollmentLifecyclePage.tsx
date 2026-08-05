import React from "react";
import { apiFetch } from "../../lib/api";
import { useBatches } from "../../hooks/useBatches";
import { ErpCard } from "../../components/Erp/ErpUI";

const STATUSES = ["Bảo lưu", "Học lại", "Chờ xếp lớp tiếp theo", "Hoàn thành khóa", "Không còn nhu cầu học"];

export function EnrollmentLifecyclePage() {
  const { batches } = useBatches();
  const [status, setStatus] = React.useState("Bảo lưu");
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => {
    let active = true;
    Promise.all(batches.map(async (batch) => {
      const payload = await apiFetch<any>(`/batches/${batch.id}/enrollments`);
      const enrollments = Array.isArray(payload?.data) ? payload.data : payload;
      return (Array.isArray(enrollments) ? enrollments : []).filter((e) => e.status === status).map((e) => ({ ...e, batch }));
    })).then((items) => active && setRows(items.flat())).catch(() => active && setRows([]));
    return () => { active = false; };
  }, [batches, status]);

  return <div className="space-y-4 p-5">
    <div><h2 className="text-lg font-black text-slate-800">Bảo lưu & trạng thái học viên</h2><p className="text-xs text-slate-500">Theo dõi, điều phối và xử lý Module 5.</p></div>
    <div className="flex flex-wrap gap-2">{STATUSES.map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-xl px-3 py-2 text-xs font-bold ${status === item ? "bg-cyan-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{item}</button>)}</div>
    <ErpCard className="overflow-hidden"><div className="divide-y divide-slate-100">{rows.length === 0 ? <p className="p-6 text-sm text-slate-400">Không có học viên ở trạng thái này.</p> : rows.map((row, index) => <div key={`${row.batch.id}-${row.studentId}-${index}`} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-bold text-slate-700">Học viên: {row.studentId}</p><p className="text-xs text-slate-500">Lớp {row.batch.code} · Còn {row.remainingSessions} buổi</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{row.status}</span></div>)}</div></ErpCard>
  </div>;
}
