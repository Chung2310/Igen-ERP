import React, { Component, Suspense, lazy, useMemo, type ReactNode } from "react";
import {
  Landmark,
  ShoppingCart,
  Users,
  GraduationCap,
  BriefcaseBusiness,
  MessagesSquare,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import {
  DASHBOARD_SUB_TAB_ROUTES,
  type DashboardSubTabType,
} from "../router/subTabRoutes";
import { ModuleNavigation, ModuleNavigationButton } from "../components/common/ModuleNavigation";
import { HrSidebarIcon, type HrSidebarIconName } from "../components/common/HrSidebarIcon";
import { OverviewPeriodContent, OverviewPeriodCustomRange, OverviewPeriodProvider, OverviewPeriodToolbar } from "../components/dashboard/OverviewPeriodContext";
import "../components/dashboard/overview-tooltip.css";

// Lazy-loaded secondary dashboard sections
const FinanceOverviewSection = lazy(
  () => import("../components/dashboard/FinanceOverviewSection")
);
const RetailOverviewSection = lazy(
  () => import("../components/dashboard/RetailOverviewSection")
);
const HrOverviewSection = lazy(
  () => import("../components/dashboard/HrOverviewSection")
);
const StudentOverviewSection = lazy(
  () => import("../components/dashboard/StudentOverviewSection")
);
const WorkerOverviewSection = lazy(
  () => import("../components/dashboard/WorkerOverviewSection")
);
const MarketingOverviewSection = lazy(
  () => import("../components/dashboard/MarketingOverviewSection")
);

interface SectionConfig {
  value: DashboardSubTabType;
  slug: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
}

const ALL_SECTIONS: SectionConfig[] = [
  {
    value: "TAI_CHINH",
    slug: "tai-chinh",
    label: "Tài chính",
    subtitle: "Thu chi, Lãi lỗ & Dòng tiền",
    icon: Landmark,
  },
  {
    value: "BAN_LE",
    slug: "ban-le",
    label: "Bán lẻ & POS",
    subtitle: "Doanh số, Đơn hàng & Ca bán",
    icon: ShoppingCart,
  },
  {
    value: "NHAN_SU",
    slug: "nhan-su",
    label: "Nhân sự",
    subtitle: "Chuyên cần, Hợp đồng & Nhân sự",
    icon: Users,
  },
  {
    value: "HOC_VIEN",
    slug: "hoc-vien",
    label: "Học viên & Đào tạo",
    subtitle: "Tuyển sinh, Học phí & Lớp học",
    icon: GraduationCap,
  },
  {
    value: "LAO_DONG",
    slug: "lao-dong",
    label: "Lao động",
    subtitle: "Hồ sơ, Tiếp nhận & Dự án",
    icon: BriefcaseBusiness,
  },
  {
    value: "MARKETING",
    slug: "marketing",
    label: "Marketing & CRM",
    subtitle: "Chiến dịch, Tương tác & Kênh",
    icon: MessagesSquare,
  },
];

class SectionErrorBoundary extends Component<
  { children: ReactNode; fallbackTitle: string },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: "" };
  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      error: error instanceof Error ? error.message : "Đã xảy ra sự cố khi tải phân hệ",
    };
  }
  componentDidCatch(error: unknown) {
    console.error("Dashboard section error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface">
          <div className="flex items-center gap-2 font-semibold text-rose-600">
            <AlertCircle size={18} />
            <span>Chưa thể tải dữ liệu phân hệ {this.props.fallbackTitle}</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">{this.state.error}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-xs transition hover:opacity-90"
          >
            Thử tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
      <span role="status" className="text-pretty text-xs font-semibold text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

export default function DashboardTab() {
  const { userProfile, hasPermission } = useAuth();

  const isAdmin =
    userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const isManager = isAdmin || userProfile?.role === "manager";
  const isTeacher = userProfile?.role === "teacher";

  const enabledModulesStr = (userProfile?.enabledModules || []).join(",");

  const allowedSections = useMemo(() => {
    const modules = enabledModulesStr ? enabledModulesStr.split(",") : [];
    const checkPerm = (code: string) => hasPermission?.(code) || false;

    return ALL_SECTIONS.filter((section) => {
      switch (section.value) {
        case "TAI_CHINH":
          return (
            modules.includes("finance") &&
            (isAdmin ||
              checkPerm("finance:read") ||
              checkPerm("finance:manage") ||
              checkPerm("accounting:read") ||
              checkPerm("accounting:manage"))
          );
        case "BAN_LE":
          return (
            modules.includes("retail") &&
            (isAdmin ||
              checkPerm("retail:read") ||
              checkPerm("retail:manage"))
          );
        case "NHAN_SU":
          return (
            modules.includes("hr") &&
            (isManager ||
              checkPerm("hr:read") ||
              checkPerm("access:read") ||
              checkPerm("timekeeping:read"))
          );
        case "HOC_VIEN":
          return (
            modules.includes("student") &&
            (isAdmin ||
              isTeacher ||
              checkPerm("people:read") ||
              checkPerm("people:manage"))
          );
        case "LAO_DONG":
          return (
            modules.includes("worker") &&
            (checkPerm("people:read") ||
              checkPerm("people:manage") ||
              checkPerm("labor-partner:read"))
          );
        case "MARKETING":
          return (
            (modules.includes("marketing") ||
              modules.includes("social-marketing")) &&
            (checkPerm("marketing:read") ||
              checkPerm("marketing:manage"))
          );
        default:
          return true;
      }
    });
  }, [isAdmin, isManager, isTeacher, enabledModulesStr, hasPermission]);

  const defaultSubTab = allowedSections[0]?.value ?? "TAI_CHINH";

  // Use the static DASHBOARD_SUB_TAB_ROUTES constant to avoid infinite re-render loops
  const [activeSubTab, setActiveSubTab] = useSubTabRouter<DashboardSubTabType>(
    DASHBOARD_SUB_TAB_ROUTES,
    defaultSubTab
  );

  // If the active tab from URL is not allowed, show the first available section.
  const isCurrentAllowed = allowedSections.some((s) => s.value === activeSubTab);
  const resolvedSubTab: DashboardSubTabType = isCurrentAllowed ? activeSubTab : defaultSubTab;
  const currentSection =
    allowedSections.find((s) => s.value === resolvedSubTab) || allowedSections[0];

  const renderContent = () => {
    if (allowedSections.length === 0) {
      return <p className="text-pretty text-sm text-on-surface-variant">Chưa có phân hệ tổng quan khả dụng.</p>;
    }
    switch (resolvedSubTab) {
      case "TAI_CHINH":
        return (
          <SectionErrorBoundary fallbackTitle="Tài chính">
            <FinanceOverviewSection />
          </SectionErrorBoundary>
        );
      case "BAN_LE":
        return (
          <SectionErrorBoundary fallbackTitle="Bán lẻ">
            <RetailOverviewSection />
          </SectionErrorBoundary>
        );
      case "NHAN_SU":
        return (
          <SectionErrorBoundary fallbackTitle="Nhân sự">
            <HrOverviewSection />
          </SectionErrorBoundary>
        );
      case "HOC_VIEN":
        return (
          <SectionErrorBoundary fallbackTitle="Học viên">
            <StudentOverviewSection />
          </SectionErrorBoundary>
        );
      case "LAO_DONG":
        return (
          <SectionErrorBoundary fallbackTitle="Lao động">
            <WorkerOverviewSection />
          </SectionErrorBoundary>
        );
      case "MARKETING":
        return (
          <SectionErrorBoundary fallbackTitle="Marketing">
            <MarketingOverviewSection />
          </SectionErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface"
      id="dashboard_tab_wrapper"
    >
      <h1 className="sr-only text-balance">
        Tổng quan hệ thống - {currentSection?.label}
      </h1>

      <OverviewPeriodProvider inlineNavigation>
      {/* Top ModuleNavigation Bar (matching HR and ERP standard pattern) */}
      <ModuleNavigation
        label="Phân hệ Tổng quan"
        activeValue={resolvedSubTab}
        layout="horizontal"
        className="mb-0"
        id="dashboard_sub_tabs_bar"
        actions={<OverviewPeriodToolbar />}
      >
        {allowedSections.map((tab) => {
          const isActive = resolvedSubTab === tab.value;
          const iconName = ({
            TAI_CHINH: 'finance', BAN_LE: 'retail',
            NHAN_SU: 'people', HOC_VIEN: 'students', LAO_DONG: 'labor',
          } as Partial<Record<DashboardSubTabType, HrSidebarIconName>>)[tab.value];
          return (
            <ModuleNavigationButton
              key={tab.value}
              active={isActive}
              icon={iconName ? <HrSidebarIcon name={iconName} /> : <tab.icon />}
              preferProvidedIcon={tab.value === "MARKETING"}
              onClick={() => setActiveSubTab(tab.value)}
            >
              {tab.label}
            </ModuleNavigationButton>
          );
        })}
      </ModuleNavigation>

      {/* Content Area with independent scroll */}
      <main
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-2 sm:py-3"
        id="dashboard_tab_content"
      >
        <OverviewPeriodCustomRange />
        <OverviewPeriodContent>
          <div className="w-full">
            <Suspense fallback={<TabLoader label={`Đang tải dữ liệu ${currentSection?.label || "tổng quan"}...`} />}>
              {renderContent()}
            </Suspense>
          </div>
        </OverviewPeriodContent>
      </main>
      </OverviewPeriodProvider>
    </div>
  );
}
