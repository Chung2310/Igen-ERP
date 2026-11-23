import "./gym.css";
import { useEffect, useMemo, useState } from "react";
import { Package, Target, Users } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import {
  ModuleNavigation,
  ModuleNavigationButton,
} from "../../components/common/ModuleNavigation";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import {
  gymAdmin,
  gymTabs,
  type GymEntity,
  type GymRecord,
  type GymTab,
} from "../../../shared/gym/types";
import { gymApi, type GymApi } from "./api";
import GymSidebarIcon from "./GymSidebarIcon";
import { Feedback, panel } from "./ui";
import CustomerPackages from "./CustomerPackages";
import RecordsPage from "./RecordsPage";
import KnowledgePage from "./KnowledgePage";
import TransfersPage from "./TransfersPage";
import InBodyPage from "./InBodyPage";
import NutritionPage from "./NutritionPage";
import RoadmapPage from "./RoadmapPage";
import WorkoutsPage from "./WorkoutsPage";
import ProgressPage from "./ProgressPage";
import TrainersPage from "./TrainersPage";
import CustomerDetail from "./CustomerDetail";

export default function GymPage() {
  const { userProfile, hasPermission } = useAuth();
  const branch = useBranch();
  if (branch.loading) return <Feedback loading />;
  if (!branch.activeBranchId)
    return <p className={panel}>Chọn chi nhánh để sử dụng Gym.</p>;
  const role = userProfile?.role || "";
  if (role !== "pt" && !gymAdmin(role))
    return <p className={panel}>Bạn không có quyền truy cập phân hệ Gym.</p>;
  return (
    <GymWorkspace
      key={`${userProfile?.uid}-${branch.activeBranchId}`}
      branchId={branch.activeBranchId}
      admin={gymAdmin(role)}
      canWrite={hasPermission("gym:manage")}
      currentUserId={userProfile?.uid || ""}
    />
  );
}

export function GymWorkspace({
  branchId,
  admin,
  canWrite,
  currentUserId = "",
}: {
  branchId: string;
  admin: boolean;
  canWrite: boolean;
  currentUserId?: string;
}) {
  const api = useMemo(() => gymApi(branchId), [branchId]);
  const adminOnlyTabs = ["knowledge", "trainers", "transfers"];
  const readTab = () => {
    const value = new URLSearchParams(window.location.search).get("sub");
    return gymTabs.some(
      ([key]) => key === value && (admin || !adminOnlyTabs.includes(key)),
    )
      ? (value as GymTab)
      : "customers";
  };
  const [tab, setTab] = useState<GymTab>(readTab);
  const [customer, setCustomer] = useState<GymRecord>();
  const [nutritionCustomerId, setNutritionCustomerId] = useState<string>();
  useEffect(() => {
    const pop = () => {
      setTab(readTab());
      setCustomer(undefined);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [admin]);
  const select = (key: GymTab) => {
    setTab(key);
    setCustomer(undefined);
    if (key !== "nutrition-plans") setNutritionCustomerId(undefined);
    const url = new URL(window.location.href);
    url.searchParams.set("sub", key);
    window.history.pushState({}, "", url);
  };
  const current = tab as GymEntity;

  return (
    <div
      id="gym_tab_wrapper"
      data-flush-card="true"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface"
    >
      <ModuleNavigation
        id="gym_sub_tabs_bar"
        label="Gym"
        activeValue={tab}
        className="mb-2 lg:mb-0"
      >
        {gymTabs
          .filter(([key]) => admin || !adminOnlyTabs.includes(key))
          .map(([key, label]) => (
            <ModuleNavigationButton
              key={key}
              active={tab === key}
              icon={<GymSidebarIcon name={key} className="size-5" />}
              filledIcon={<GymSidebarIcon name={key} className="size-5" />}
              preferProvidedIcon
              title={label}
              onClick={() => select(key)}
            >
              {label}
            </ModuleNavigationButton>
          ))}
      </ModuleNavigation>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 pt-2 lg:pl-0">
        {customer ? (
          <CustomerDetail
            api={api}
            record={customer}
            onClose={() => setCustomer(undefined)}
            canWrite={canWrite}
            onNavigateNutrition={(customerId) => {
              setNutritionCustomerId(customerId);
              select("nutrition-plans");
            }}
          />
        ) : tab === "customers" ? (
          <CustomersHub api={api} canWrite={canWrite} onCustomer={setCustomer} />
        ) : tab === "measurements" ? (
          <InBodyPage api={api} canWrite={canWrite} />
        ) : tab === "nutrition-plans" ? (
          <NutritionPage
            key={nutritionCustomerId || "all"}
            api={api}
            canWrite={canWrite}
            initialCustomerId={nutritionCustomerId}
          />
        ) : tab === "roadmaps" ? (
          <RoadmapPage api={api} canWrite={canWrite} />
        ) : tab === "workout-templates" ? (
          <WorkoutsPage api={api} canWrite={canWrite} />
        ) : tab === "progress" ? (
          <ProgressPage api={api} canWrite={canWrite} onOpenCustomer={setCustomer} />
        ) : tab === "knowledge" && admin ? (
          <KnowledgePage api={api} admin={admin} canWrite={canWrite} />
        ) : tab === "transfers" && admin ? (
          <TransfersPage api={api} admin={admin} currentUserId={currentUserId} />
        ) : tab === "trainers" && admin ? (
          <TrainersPage api={api} canWrite={canWrite} />
        ) : (
          <RecordsPage
            key={current}
            api={api}
            entity={current}
            canWrite={canWrite}
            onCustomer={setCustomer}
          />
        )}
      </main>
    </div>
  );
}

function CustomersHub({
  api,
  canWrite,
  onCustomer,
}: {
  api: GymApi;
  canWrite: boolean;
  onCustomer: (record: GymRecord) => void;
}) {
  const [sub, setSub] = useState<"customers" | "goals">("customers");
  const [packagesCustomer, setPackagesCustomer] = useState<GymRecord | null>(null);
  const tabs = (
    <nav aria-label="Quản lý khách hàng" className="flex gap-1">
      {([
        ["customers", "Khách hàng", Users],
        ["goals", "Mục tiêu", Target],
      ] as const).map(([key, label, Icon]) => {
        const active = sub === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => setSub(key)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
              active
                ? "border-primary font-semibold text-primary"
                : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
  return (
    <>
      <RecordsPage
        key={sub}
        api={api}
        entity={sub}
        canWrite={canWrite}
        embedded
        headerLeft={tabs}
        onCustomer={sub === "customers" ? onCustomer : undefined}
        extraActions={
          sub === "customers"
            ? (row) => (
                <button
                  type="button"
                  aria-label={`Quản lý gói PT của ${row.fullName}`}
                  title="Gói tập PT"
                  onClick={() => setPackagesCustomer(row)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Package className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Gói PT</span>
                </button>
              )
            : undefined
        }
      />
      {packagesCustomer && (
        <ErpModal
          native
          title={`Gói tập PT — ${packagesCustomer.fullName}`}
          onClose={() => setPackagesCustomer(null)}
          maxWidth="max-w-3xl"
        >
          <CustomerPackages
            api={api}
            customerId={packagesCustomer._id}
            canWrite={canWrite}
          />
        </ErpModal>
      )}
    </>
  );
}
