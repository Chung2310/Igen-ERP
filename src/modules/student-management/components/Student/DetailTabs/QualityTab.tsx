import React from "react";
import { BookOpenCheck, GraduationCap, Loader2, Route, Users } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import type { Student } from "../../../types";

type LearningEntry = {
  id: string;
  batchCode: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  status: "active" | "removed" | "completed";
  batchStatus: string;
  enrolledAt: string | null;
  leftAt: string | null;
};

type LearningHistory = {
  summary: { totalClasses: number; totalCourses: number };
  entries: LearningEntry[];
};

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa xác định";
const statusPresentation: Record<LearningEntry["status"], { label: string; className: string }> = {
  active: { label: "Đang học", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  completed: { label: "Hoàn thành", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  removed: { label: "Đã rời lớp", className: "border-slate-200 bg-slate-100 text-slate-600" },
};

export function QualityTab({ student }: { student: Student }) {
  const [data, setData] = React.useState<LearningHistory | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    void apiFetch<{ success: boolean; data: LearningHistory }>(`/students/${student.id}/learning-history`)
      .then((response) => { if (active) setData(response.data); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student.id]);

  if (loading) return <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang tải lịch sử học tập...</div>;
  if (!data || !data.entries.length) return <div className="border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">Học viên chưa có lịch sử lớp học.</div>;

  const activeClasses = data.entries.filter((entry) => entry.status === "active").length;
  const completedClasses = data.entries.filter((entry) => entry.status === "completed").length;
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary icon={GraduationCap} label="Lớp đã tham gia" value={data.summary.totalClasses} /><Summary icon={BookOpenCheck} label="Khóa học" value={data.summary.totalCourses} /><Summary icon={Users} label="Đang học" value={activeClasses} tone="cyan" /><Summary icon={Route} label="Đã hoàn thành" value={completedClasses} tone="emerald" /></div><section className="border border-slate-200 bg-white"><header className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-800">Lộ trình học tập</h3><p className="mt-1 text-xs text-slate-500">Lịch sử lớp và khóa học của học viên, sắp xếp từ mới nhất đến cũ nhất.</p></header><div className="divide-y divide-slate-100">{data.entries.map((entry, index) => { const status = statusPresentation[entry.status]; return <div key={entry.id} className="flex items-start gap-4 px-4 py-4"><div className="flex w-5 flex-col items-center self-stretch"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${entry.status === "active" ? "bg-cyan-500" : entry.status === "completed" ? "bg-emerald-500" : "bg-slate-400"}`} />{index < data.entries.length - 1 ? <span className="mt-2 w-px flex-1 bg-slate-200" /> : null}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-800">{entry.batchCode}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span></div><p className="mt-1 text-sm text-slate-600">{entry.courseTitle}{entry.instructorName ? ` · ${entry.instructorName}` : ""}</p><p className="mt-1 text-xs text-slate-400">Bắt đầu {dateLabel(entry.enrolledAt)}{entry.leftAt ? ` · Kết thúc ${dateLabel(entry.leftAt)}` : ""}</p></div></div>; })}</div></section></div>;
}

function Summary({ icon: Icon, label, value, tone = "slate" }: { icon: typeof GraduationCap; label: string; value: number; tone?: "slate" | "cyan" | "emerald" }) {
  const color = tone === "cyan" ? "bg-cyan-50 text-cyan-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <div className="border border-slate-200 bg-white p-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}><Icon className="h-4 w-4" /></div><p className="mt-3 text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p></div>;
}
