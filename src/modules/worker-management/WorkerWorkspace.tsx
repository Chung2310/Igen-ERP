import React, { Suspense, lazy } from "react";
import { Bell, BriefcaseBusiness, ChevronDown, LayoutDashboard, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { setEntityPreset, useAdminCenters, setBusinessApiScope } from "../shared-management/runtime";
import WorkersPage from "./pages/WorkersPage";
import { canManageWorkerArea, canReadWorkerArea } from "./workerPermissionPolicy";
import { getAllowedWorkerTabSlugs } from "./workerTabPermissions";

type WorkerSubTab = "TỔNG QUAN" | "DỰ ÁN" | "LAO ĐỘNG" | "THÔNG BÁO";
const DashboardPage = lazy(() => import("../shared-management/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectsPage = lazy(() => import("../shared-management/pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const NotificationsPage = lazy(() => import("../shared-management/pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));

const SUB_TABS = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const, label: "Tổng quan", icon: LayoutDashboard },
  { slug: "du-an", value: "DỰ ÁN" as const, label: "Dự án", icon: BriefcaseBusiness },
  { slug: "lao-dong", value: "LAO ĐỘNG" as const, label: "Lao động", icon: Users },
  { slug: "thong-bao", value: "THÔNG BÁO" as const, label: "Thông báo", icon: Bell },
];

const formatDate = () => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
const Loader = () => <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">Đang tải phân hệ lao động...</div>;

export default function WorkerWorkspace() {
  const { userProfile } = useAuth();
  const { centers } = useAdminCenters();
  const [ready, setReady] = React.useState(false);
  React.useLayoutEffect(() => { setBusinessApiScope("worker"); setEntityPreset("worker"); setReady(true); }, []);

  const allowedSlugs = getAllowedWorkerTabSlugs(userProfile?.permissions || []);
  const tabs = SUB_TABS.filter((tab) => allowedSlugs.includes(tab.slug as (typeof allowedSlugs)[number]));
  const [center, setCenter] = React.useState(() => userProfile?.role === "superadmin" ? "all" : (userProfile as any)?.centerId || userProfile?.companyCode || "all");
  const [activeTab, setActiveTab] = useSubTabRouter<WorkerSubTab>(tabs, tabs[0]?.value || "TỔNG QUAN");
  const canRead = canReadWorkerArea(userProfile?.permissions || [], "worker-profile");
  const canManage = (area: Parameters<typeof canManageWorkerArea>[1]) => canManageWorkerArea(userProfile?.permissions || [], area);

  if (!ready) return <Loader />;
  if (!tabs.length) return <div className="flex h-full min-h-[320px] items-center justify-center bg-white p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng này</div></div>;

  const page = activeTab === "TỔNG QUAN"
    ? <DashboardPage formattedDate={formatDate()} onSelectStudent={() => {}} onNavigate={() => {}} selectedCenter={center} />
    : activeTab === "LAO ĐỘNG"
      ? <WorkersPage selectedCenter={center} canManage={canManage("worker-profile")} />
      : activeTab === "DỰ ÁN"
        ? <ProjectsPage selectedCenter={center} canManage={canManage("project")} />
        : <NotificationsPage canManage={canManage("notification")} />;

  return <div className="flex h-full min-h-0 flex-col bg-white">
    <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200/80 bg-white px-5 pb-0 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between" id="worker_sub_tabs_bar">
      <div className="flex select-none gap-1 overflow-x-auto">{tabs.map((tab) => { const active = activeTab === tab.value; const Icon = tab.icon; return <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${active ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"}`}><Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} /><span>{tab.label}</span></button>; })}</div>
      {userProfile?.role === "superadmin" && <div className="flex shrink-0 items-center gap-2 pb-2 pr-2 sm:pb-0"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cơ sở:</span><div className="relative min-w-[200px]"><select value={center} onChange={(event) => setCenter(event.target.value)} className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-bold text-slate-700 outline-none"><option value="all">Tất cả cơ sở</option>{centers.map((item) => <option key={item.uid} value={item.uid}>{item.displayName}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /></div></div>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-6"><Suspense fallback={<Loader />}>{page}</Suspense></div>
  </div>;
}
