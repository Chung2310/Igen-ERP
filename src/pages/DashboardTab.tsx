/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Clock3, FolderOpen, GraduationCap, ListTodo, MessageSquare, RefreshCw, Users } from "lucide-react";
import { dashboardService } from "../services/dashboardService";
import type { DashboardDateFilter, DashboardSummary } from "../types/dashboard";
const FILTERS: Array<{ value: DashboardDateFilter; label: string }> = [{ value: "day", label: "Hôm nay" }, { value: "week", label: "7 ngày" }, { value: "year", label: "Năm nay" }];
const nf = new Intl.NumberFormat("vi-VN");
const num = (value?: number) => nf.format(value || 0);
const money = (value?: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
type MetricProps = { key?: React.Key; title: string; value: string; detail: string; icon: React.ElementType; color: string };
function Metric({ title, value, detail, icon: Icon, color }: MetricProps) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" /></span></div></article>;
}
export default function DashboardTab() {
  const [filter, setFilter] = useState<DashboardDateFilter>("day");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = React.useCallback(async () => { setLoading(true); setError(""); try { setSummary(await dashboardService.getSummary({ filter })); } catch (err) { setError(err instanceof Error ? err.message : "Không thể tải dữ liệu tổng quan."); } finally { setLoading(false); } }, [filter]);
  useEffect(() => { void load(); }, [load]);
  const metrics: MetricProps[] = [
    { title: "Dự án đang hoạt động", value: num(summary?.projects.activeProjects), detail: `${num(summary?.projects.tasks.total)} công việc`, icon: ListTodo, color: "bg-blue-50 text-blue-600" },
    { title: "Công việc hoàn thành", value: num(summary?.projects.tasks.done), detail: `${num(summary?.projects.overdueTasks)} công việc quá hạn`, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
    { title: "Nhân sự chấm công", value: num(summary?.timekeeping.checkedInToday), detail: `${num(summary?.timekeeping.lateToday)} trường hợp đi muộn`, icon: Users, color: "bg-indigo-50 text-indigo-600" },
    { title: "Học viên", value: num(summary?.students.totalStudents), detail: `${num(summary?.students.newStudents)} học viên mới`, icon: GraduationCap, color: "bg-violet-50 text-violet-600" },
    { title: "Doanh thu học phí", value: money(summary?.students.tuitionRevenue), detail: `${num(summary?.students.paymentCount)} khoản thanh toán`, icon: BookOpen, color: "bg-amber-50 text-amber-600" },
    { title: "Tài nguyên", value: num(summary?.resources.fileCount), detail: `${num(summary?.resources.recentUploads)} tệp mới trong kỳ`, icon: FolderOpen, color: "bg-cyan-50 text-cyan-600" },
    { title: "Khóa đào tạo", value: num(summary?.training.ongoingCourses), detail: `${num(summary?.training.enrollments.inProgress)} lượt đang học`, icon: Clock3, color: "bg-orange-50 text-orange-600" },
    { title: "Tin nhắn chưa đọc", value: num(summary?.chat.unreadMessages), detail: `${num(summary?.chat.roomCount)} phòng trò chuyện`, icon: MessageSquare, color: "bg-sky-50 text-sky-600" }
  ];
  return <main className="min-h-full bg-slate-50/70 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Tổng quan doanh nghiệp</h1><p className="mt-1 text-sm text-slate-500">Theo dõi vận hành, nhân sự, đào tạo và tài nguyên tại một nơi.</p></div><div className="flex items-center gap-2">{FILTERS.map(item => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${filter === item.value ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>)}<button type="button" onClick={() => void load()} disabled={loading} aria-label="Làm mới dữ liệu" className="rounded-lg bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button></div></header>{error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <Metric key={metric.title} {...metric} />)}</section></div></main>;
}
