import type { Project } from "../../types/hr";

const statusLabels = { not_started: "Chưa bắt đầu", in_progress: "Đang thực hiện", paused: "Tạm dừng", completed: "Hoàn thành", cancelled: "Đã hủy" };
const priorityLabels = { low: "Thấp", medium: "Trung bình", high: "Cao", urgent: "Khẩn cấp" };
const date = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN", { hour12: false }) : "Chưa thiết lập";

export function KanbanProjectSummary({ project, expanded = false }: { project: Project; expanded?: boolean }) {
  const progress = project.progress || { completed: 0, total: 0, percent: 0 };
  return <div className="min-w-0 flex-1 text-xs">
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{statusLabels[project.status || "not_started"]}</span>
      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{priorityLabels[project.priority || "medium"]}</span>
      <span className="font-semibold text-slate-600">{progress.completed}/{progress.total} · {progress.percent}%</span>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${progress.percent}%` }} /></div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-500"><span>Bắt đầu: {date(project.startAt)}</span><span>Hạn cuối: {date(project.dueAt)}</span></div>
    {expanded && <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="text-slate-500">Hoàn thành thực tế: {date(project.completedAt)}</div>
      <div className="mt-2 font-semibold text-slate-700">Tài liệu</div>
      {project.attachments?.length ? <div className="mt-1 flex flex-wrap gap-2">{project.attachments.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{item.name}</a>)}</div> : <div className="text-slate-400">Chưa có tài liệu</div>}
    </div>}
  </div>;
}
