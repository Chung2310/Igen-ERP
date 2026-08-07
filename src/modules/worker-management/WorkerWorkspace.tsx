import React, { Suspense, lazy, useRef } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import {
  useAdminCenters,
  useStandardFields,
} from "./workerRuntime";
import { workerApiFetch } from "./api/client";
import { WorkerDetailModal } from "./components/WorkerDetailModal";
import { useWorkers } from "./hooks/useWorkers";
import WorkersPage from "./pages/WorkersPage";
import type {
  Worker,
  WorkerProfileFieldConfig,
  WorkerProfileFieldKey,
  WorkerProject,
  WorkerProjectSummary,
  WorkerScope,
  WorkerStatus,
} from "./types";
import { canManageWorkerArea } from "./workerPermissionPolicy";

import { getAllowedWorkerTabSlugs } from "./workerTabPermissions";

const WORKER_PROFILE_FIELD_KEYS: WorkerProfileFieldKey[] = [
  "fullName",
  "phone",
  "email",
  "idCard",
  "birthday",
  "registrationDate",
  "address",
  "status",
  "note",
];

const isWorkerProfileFieldKey = (key: string): key is WorkerProfileFieldKey =>
  WORKER_PROFILE_FIELD_KEYS.includes(key as WorkerProfileFieldKey);

type WorkerSubTab = "TỔNG QUAN" | "DỰ ÁN" | "LAO ĐỘNG" | "THÔNG BÁO";

const DashboardPage = lazy(() => import("./pages/WorkerDashboardPage").then((module) => ({ default: module.WorkerDashboardPage })));
const WorkerProjectsPage = lazy(() =>
  import("./pages/WorkerProjectsPage").then((module) => ({
    default: module.WorkerProjectsPage,
  })),
);
const NotificationsPage = lazy(() => import("./pages/WorkerNotificationsPage").then((module) => ({ default: module.WorkerNotificationsPage })));

const SUB_TABS = [
  {
    slug: "tong-quan",
    value: "TỔNG QUAN" as const,
    label: "Tổng quan",
    icon: LayoutDashboard,
  },
  {
    slug: "du-an",
    value: "DỰ ÁN" as const,
    label: "Dự án",
    icon: BriefcaseBusiness,
  },
  {
    slug: "lao-dong",
    value: "LAO ĐỘNG" as const,
    label: "Lao động",
    icon: Users,
  },
  {
    slug: "thong-bao",
    value: "THÔNG BÁO" as const,
    label: "Thông báo",
    icon: Bell,
  },
];

const formatDate = () =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

const Loader = () => (
  <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">
    Đang tải phân hệ lao động...
  </div>
);

function normalizeDashboardWorker(value: any): Worker {
  const supportedStatuses: WorkerStatus[] = ["active", "placed", "inactive"];
  return {
    _id: String(value?._id || value?.id || ""),
    fullName: String(value?.fullName || ""),
    phone: value?.phone,
    email: value?.email,
    idCard: value?.idCard,
    birthday: value?.birthday,
    registrationDate: value?.registrationDate,
    address: value?.address,
    note: value?.note,
    branchId: value?.branchId,
    customFields: value?.customFields,
    status: supportedStatuses.includes(value?.status)
      ? value.status
      : "active",
  };
}

function WorkerProfilesRuntime({
  selectedCenter,
  branchId,
  registrationOwnerId,
  canManage,
  projects,
  profileFields,
}: {
  selectedCenter: string;
  branchId?: string;
  registrationOwnerId?: string;
  canManage: boolean;
  projects: WorkerProjectSummary[];
  profileFields: WorkerProfileFieldConfig[];
}) {
  return (
    <WorkersPage
      selectedCenter={selectedCenter}
      branchId={branchId}
      registrationOwnerId={registrationOwnerId}
      canManage={canManage}
      projects={projects}
      profileFields={profileFields}
    />
  );
}

export default function WorkerWorkspace() {
  const subTabsRef = useRef<HTMLDivElement>(null);
  const scrollSubTabs = (direction: "left" | "right") => subTabsRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  const { userProfile } = useAuth();
  const { centers } = useAdminCenters();
  const [ready, setReady] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(
    null,
  );

  React.useLayoutEffect(() => { setReady(true); }, []);

  const allowedSlugs = getAllowedWorkerTabSlugs(
    userProfile?.permissions || [],
  );
  const tabs = SUB_TABS.filter((tab) =>
    allowedSlugs.includes(tab.slug as (typeof allowedSlugs)[number]),
  );
  const [center, setCenter] = React.useState(() =>
    userProfile?.role === "superadmin"
      ? "all"
      : (userProfile as any)?.centerId ||
        userProfile?.companyCode ||
        "all",
  );
  const [activeTab, setActiveTab] = useSubTabRouter<WorkerSubTab>(
    tabs,
    tabs[0]?.value || "TỔNG QUAN",
  );
  const canManage = (area: Parameters<typeof canManageWorkerArea>[1]) =>
    canManageWorkerArea(userProfile?.permissions || [], area);
  const scope = React.useMemo<WorkerScope | undefined>(
    () =>
      center !== "all"
        ? {
            companyCode: center,
            ...(userProfile?.branchId
              ? { branchId: userProfile.branchId }
              : {}),
          }
        : undefined,
    [center, userProfile?.branchId],
  );

  const { workers: workspaceWorkers, updateWorker } = useWorkers(scope);
  const scopeKey = scope ? `${scope.companyCode}:${scope.branchId || ""}` : "";
  const { fields } = useStandardFields(
    "students",
    undefined,
    center !== "all" ? center : undefined,
  );
  const profileFields = React.useMemo<WorkerProfileFieldConfig[]>(
    () =>
      fields
        .filter((field) => isWorkerProfileFieldKey(field.key))
        .map((field) => ({
          key: field.key as WorkerProfileFieldKey,
          label: field.label,
          isRequired: field.isRequired,
          isVisible: field.isVisible && !field.isArchived,
        })),
    [fields],
  );
  const [projectState, setProjectState] = React.useState<{
    scopeKey: string;
    items: WorkerProjectSummary[];
  }>({ scopeKey, items: [] });
  const projects =
    projectState.scopeKey === scopeKey ? projectState.items : [];
  React.useEffect(() => {
    let active = true;
    if (!scope) {
      setProjectState({ scopeKey, items: [] });
      return () => {
        active = false;
      };
    }
    void workerApiFetch<{ data: WorkerProject[] }>("/worker-management/projects", {
      params: scope,
    })
      .then((response) => {
        if (!active) return;
        setProjectState({
          scopeKey,
          items: response.data.map((project) => ({
            id: project._id,
            name: project.name || project.code,
          })),
        });
      })
      .catch(() => {
        if (active) setProjectState({ scopeKey, items: [] });
      });
    return () => {
      active = false;
    };
  }, [scope, scopeKey]);

  const openDashboardWorker = React.useCallback((value: unknown) => {
    const worker = normalizeDashboardWorker(value);
    if (worker._id) setSelectedWorker(worker);
  }, []);

  if (!ready) return <Loader />;
  if (!tabs.length) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-white p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-semibold text-amber-800">
          Bạn chưa được cấp quyền sử dụng chức năng này
        </div>
      </div>
    );
  }

  const page =
    activeTab === "TỔNG QUAN" ? (
      <DashboardPage
        formattedDate={formatDate()}
        onSelectStudent={openDashboardWorker}
        onNavigate={() => {}}
        selectedCenter={center}
      />
    ) : activeTab === "LAO ĐỘNG" ? (
      <WorkerProfilesRuntime
        selectedCenter={center}
        branchId={userProfile?.branchId}
        registrationOwnerId={userProfile?.uid}
        canManage={canManage("worker-profile")}
        projects={projects}
        profileFields={profileFields}
      />
    ) : activeTab === "DỰ ÁN" ? (
      <WorkerProjectsPage
        selectedCenter={center}
        branchId={userProfile?.branchId}
        canManage={canManage("project")}
      />
    ) : (
      <NotificationsPage canManage={canManage("notification")} />
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className="flex shrink-0 flex-col gap-3 border-b border-slate-200/80 bg-white px-3 pb-0 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5"
        id="worker_sub_tabs_bar"
      >
        <button type="button" aria-label="Cuộn tab lao động sang trái" onClick={() => scrollSubTabs("left")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
        <div ref={subTabsRef} className="flex min-w-0 flex-1 select-none gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.value;
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? "text-white" : "text-slate-400"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Cuộn tab lao động sang phải" onClick={() => scrollSubTabs("right")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 sm:hidden"><ChevronRight className="h-4 w-4" /></button>
        {userProfile?.role === "superadmin" && (
          <div className="flex shrink-0 items-center gap-2 pb-2 pr-2 sm:pb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Cơ sở:
            </span>
            <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:flex-none">
              <select
                value={center}
                onChange={(event) => setCenter(event.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Tất cả cơ sở</option>
                {centers.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {item.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <Suspense fallback={<Loader />}>{page}</Suspense>
      </div>
      <WorkerDetailModal
        worker={selectedWorker}
        workers={workspaceWorkers}
        profileFields={profileFields}
        onClose={() => setSelectedWorker(null)}
        onSubmit={async (id, input) => {
          return updateWorker(id, input);
        }}
        onSuccess={setSelectedWorker}
      />
    </div>
  );
}
