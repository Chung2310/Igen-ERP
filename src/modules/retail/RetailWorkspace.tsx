import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { ChartColumn, Clock3, FileText, ListOrdered, RotateCcw, Settings, ShieldCheck, Store, Ticket } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";
import { retailShiftsApi } from "./api/retailShifts.api";
import { useRetailScope } from "./hooks/useRetailScope";
import { cn } from "../student-management/lib/utils";
import { toast } from "../../pages/Toast";
import "./retail-workspace.css";

const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const CouponsPage = lazy(() => import("./pages/RetailCouponsPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPageV2"));
const ReturnsPage = lazy(() => import("./pages/RetailReturnsPage"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const OrderWarrantyPage = lazy(() => import("./pages/OrderWarrantyPage"));
const ShiftWorkspace = lazy(() => import("./pages/RetailShiftWorkspace"));
const FinancePage = lazy(() => import("./pages/RetailFinancePage"));

type RetailSubTab = (typeof SUB_TABS)[number]["value"];

const SUB_TABS = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as const, label: "Bảo hành", icon: ShieldCheck },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "doi-tra", value: "ĐỔI TRẢ" as const, label: "Đổi trả", icon: RotateCcw },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
  { slug: "ca-pos", value: "CA POS" as const, label: "Ca POS", icon: Clock3 },
  { slug: "tai-chinh", value: "TÀI CHÍNH" as const, label: "Tài chính", icon: ChartColumn },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
  { slug: "ma-uu-dai", value: "MÃ ƯU ĐÃI" as const, label: "Ưu đãi và điểm", icon: Ticket },
];

export default function RetailWorkspace() {
  const { userProfile } = useAuth();
  const { scope } = useRetailScope();
  const [openingPos, setOpeningPos] = useState(false);
  const canOpenPos = userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.some((permission) => ["*", "pos:manage", "retail:manage"].includes(permission)));
  const allowed = getAllowedRetailTabSlugs(
    userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || [],
  );
  const tabs = SUB_TABS.filter((tab) => allowed.includes(tab.slug as (typeof allowed)[number]));
  const routes = tabs.some((tab) => tab.slug === "ma-uu-dai")
    ? [...tabs, { slug: "uu-dai", value: "MÃ ƯU ĐÃI" as const }]
    : tabs;
  const [activeTab, setActiveTab] = useSubTabRouter<RetailSubTab>(routes, tabs[0]?.value || "ĐƠN HÀNG");
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeTab]);

  const openPos = async () => {
    if (openingPos) return;
    if (!scope) { toast.error("Chọn chi nhánh trước khi vào quầy POS."); return; }
    setOpeningPos(true);
    try {
      const shift = await retailShiftsApi.current(scope);
      if (!shift) {
        toast.info("Quầy POS chỉ dùng phiên của tài khoản đang đăng nhập. Hãy đăng nhập bằng tài khoản nhân viên được mở phiên.");
        return;
      }
      window.history.pushState(null, "", "/pos");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
      toast.error("Không kiểm tra được phiên POS. Vui lòng thử lại.");
    } finally {
      setOpeningPos(false);
    }
  };

  if (!tabs.length) {
    return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng này.</div>;
  }

  return (
    <div className="retail-management-workspace flex h-full min-h-0 flex-col bg-surface text-on-surface">
      <ModuleNavigation label="Mục Bán hàng" activeValue={activeTab}>
        {tabs.map(tab => <ModuleNavigationButton key={tab.slug} active={activeTab === tab.value} icon={<tab.icon />} onClick={() => setActiveTab(tab.value)}>{tab.label}</ModuleNavigationButton>)}
        {canOpenPos && <ModuleNavigationButton active={false} disabled={openingPos} icon={<Store />} onClick={() => void openPos()} title="Vào quầy POS bằng phiên của tài khoản đang đăng nhập" className="text-primary">Vào quầy POS</ModuleNavigationButton>}
      </ModuleNavigation>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1 sm:pb-4 lg:pl-0 [overflow-anchor:none]">
        <div className={cn("min-h-full rounded-md border border-outline-variant bg-surface-container-lowest p-4", activeTab === "BẢO HÀNH" && "flex flex-col")}>
          <Suspense fallback={<div role="status" className="text-sm text-on-surface-variant">Đang tải phân hệ bán hàng...</div>}>
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "ĐỔI TRẢ" && <ReturnsPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "CA POS" && <ShiftWorkspace />}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
          {activeTab === "MÃ ƯU ĐÃI" && <CouponsPage canManagePoints={userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.includes("*")) || Boolean(userProfile?.permissions?.includes("retail-points:manage") && userProfile?.permissions?.includes("retail-coupon:manage"))} />}
          {activeTab === "TÀI CHÍNH" && <FinancePage />}
          {activeTab === "BẢO HÀNH" && <OrderWarrantyPage />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
