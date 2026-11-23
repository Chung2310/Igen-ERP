import type { Project } from "../../types/hr";

const statusLabels = { not_started: "Chưa bắt đầu", in_progress: "Đang thực hiện", paused: "Tạm dừng", completed: "Hoàn thành", cancelled: "Đã hủy" };
const statusColors = {
  not_started: "border border-[#DCDCDC] bg-[#F3F4F6] text-[#555555]",
  in_progress: "bg-[#D9EDF7] text-[#286090] uppercase",
  paused: "bg-[#F0AD4E] text-white uppercase",
  completed: "bg-[#5CB85C] text-white uppercase",
  cancelled: "bg-[#E06666] text-white uppercase",
};
const priorityLabels = { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" };
const date = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN", { hour12: false }) : "Chưa thiết lập";

export function KanbanProjectSummary({ project, expanded = false }: { project: Project; expanded?: boolean }) {
  if (expanded) return <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 text-xs">
    <div className="text-slate-500">Hoàn thành thực tế: {date(project.completedAt)}</div>
    <div className="mt-2 font-medium text-slate-700">Tài liệu</div>
    {project.attachments?.length ? <div className="mt-1 flex flex-wrap gap-2">{project.attachments.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-[#007EB8] hover:underline">{item.name}</a>)}</div> : <div className="text-slate-400">Chưa có tài liệu</div>}
  </div>;
  const progress = project.progress || { completed: 0, total: 0, percent: 0 };
  const isComplete = project.status === "completed" || progress.percent >= 100;
  return <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4 ${statusColors[project.status || "not_started"]}`}>{statusLabels[project.status || "not_started"]}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4 ${project.priority === "high" || project.priority === "urgent" ? "bg-[#E06666] text-white" : project.priority === "low" ? "bg-[#5CB85C] text-white" : "bg-[#F0AD4E] text-white"}`}>{priorityLabels[project.priority || "medium"]}</span>
      <span className="tabular-nums text-slate-600">{progress.completed}/{progress.total} · {progress.percent}%</span>
      <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className={`h-1.5 w-24 shrink-0 overflow-hidden rounded-full ${isComplete ? "bg-[#DCFCE7]" : "bg-[#E8F7FF]"}`}><div className={`h-full ${isComplete ? "bg-[#22C55E]" : "bg-[#00ADFC]"}`} style={{ width: `${progress.percent}%` }} /></div>
      <span className="tabular-nums text-slate-500">Bắt đầu: {date(project.startAt)}</span>
      <span className="tabular-nums text-slate-500">Hạn cuối: {date(project.dueAt)}</span>
  </div>;
}
