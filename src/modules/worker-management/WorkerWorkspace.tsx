import React, { Suspense, lazy } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import {
  Bell,
  BriefcaseBusiness,
  FileSignature,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import {
  useAdminCenters,
  useStandardFields,
} from "./workerRuntime";
import { workerApiFetch } from "./api/client";
import { StyledSelect } from "../../components/common/StyledSelect";
import "./worker-ui.css";
import WorkersPage from "./pages/WorkersPage";
import type {
  WorkerProfileFieldConfig,
  WorkerProfileFieldKey,
  WorkerProject,
  WorkerProjectSummary,
  WorkerScope,
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
  "laborType",
  "nationality",
  "workPermitNumber",
  "workPermitExpiry",
  "note",
];

const isWorkerProfileFieldKey = (key: string): key is WorkerProfileFieldKey =>
  WORKER_PROFILE_FIELD_KEYS.includes(key as WorkerProfileFieldKey);

type WorkerSubTab = "DỰ ÁN" | "LAO ĐỘNG" | "HỢP ĐỒNG" | "THÔNG BÁO";

const WorkerProjectsPage = lazy(() =>
  import("./pages/WorkerProjectsPage").then((module) => ({
    default: module.WorkerProjectsPage,
  })),
);
const WorkerContractsPage = lazy(() => import("./pages/WorkerContractsPage"));
const NotificationsPage = lazy(() => import("./pages/WorkerNotificationsPage").then((module) => ({ default: module.WorkerNotificationsPage })));

const SUB_TABS = [
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
    slug: "hop-dong",
    value: "HỢP ĐỒNG" as const,
    label: "Hợp đồng",
    icon: FileSignature,
  },
  {
    slug: "thong-bao",
    value: "THÔNG BÁO" as const,
    label: "Thông báo",
    icon: Bell,
  },
];

const Loader = () => (
  <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">
    Đang tải phân hệ lao động...
  </div>
);

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
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const { centers } = useAdminCenters();
  const [ready, setReady] = React.useState(false);
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
    tabs[0]?.value || "DỰ ÁN",
  );
  const canManage = (area: Parameters<typeof canManageWorkerArea>[1]) =>
    canManageWorkerArea(userProfile?.permissions || [], area);
  const branchId = activeBranchId || userProfile?.branchId;
  const scope = React.useMemo<WorkerScope | undefined>(
    () =>
      center !== "all"
        ? {
            companyCode: center,
            ...(branchId
              ? { branchId }
              : {}),
          }
        : undefined,
    [branchId, center],
  );

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
    activeTab === "LAO ĐỘNG" ? (
      <WorkerProfilesRuntime
        selectedCenter={center}
        branchId={branchId}
        registrationOwnerId={userProfile?.uid}
        canManage={canManage("worker-profile")}
        projects={projects}
        profileFields={profileFields}
      />
    ) : activeTab === "HỢP ĐỒNG" ? (
      <WorkerContractsPage
        selectedCenter={center}
        branchId={branchId}
        canManage={canManage("worker-profile")}
      />
    ) : activeTab === "DỰ ÁN" ? (
      <WorkerProjectsPage
        selectedCenter={center}
        branchId={branchId}
        canManage={canManage("project")}
      />
    ) : (
      <NotificationsPage canManage={canManage("notification")} />
    );

  return (
    <div className="worker-workspace flex h-full min-h-0 flex-col bg-surface text-on-surface">
      <ModuleNavigation label="Mục Lao động" activeValue={activeTab} id="worker_sub_tabs_bar" actions={userProfile?.role === "superadmin" && <div className="flex min-w-0 items-center gap-2">
        <span className="text-xs text-on-surface-variant">Cơ sở</span>
        <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
          <StyledSelect value={center} onChange={setCenter} ariaLabel="Chọn cơ sở lao động" options={[{ value: "all", label: "Tất cả cơ sở" }, ...centers.map(item => ({ value: item.uid, label: item.displayName }))]} className="h-9" />
        </div>
      </div>}>
        {tabs.map(tab => <ModuleNavigationButton key={tab.value} active={activeTab === tab.value} icon={<tab.icon />} onClick={() => setActiveTab(tab.value)}>{tab.label}</ModuleNavigationButton>)}
      </ModuleNavigation>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-3 py-0 lg:pl-0">
        <div className="min-h-full rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <Suspense fallback={<Loader />}>{page}</Suspense>
        </div>
      </div>
    </div>
  );
}
