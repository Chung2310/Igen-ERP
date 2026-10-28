import { lazy, Suspense } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { ArrowUpRight, ChartColumn, Clock3, FileText, ListOrdered, RotateCcw, Settings, ShieldCheck, Store, Ticket } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const CouponsPage = lazy(() => import("./pages/RetailCouponsPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPageV2"));
const ReturnsPage = lazy(() => import("./pages/RetailReturnsPage"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const OrderWarrantyPage = lazy(() => import("./pages/OrderWarrantyPage"));
const ShiftWorkspace = lazy(() => import("./pages/RetailShiftWorkspace"));
const FinancePage = lazy(() => import("./pages/RetailFinancePage"));
const PromotionsPage = lazy(() => import("./pages/RetailPromotionsPage"));

type RetailSubTab = (typeof SUB_TABS)[number]["value"];

const SUB_TABS = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as const, label: "Bảo hành", icon: ShieldCheck },
  { slug: "ban-hang", value: "BÁN HÀNG" as const, label: "Tổng quan", icon: Store },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "doi-tra", value: "ĐỔI TRẢ" as const, label: "Đổi trả", icon: RotateCcw },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
  { slug: "ca-pos", value: "CA POS" as const, label: "Ca POS", icon: Clock3 },
  { slug: "tai-chinh", value: "TÀI CHÍNH" as const, label: "Tài chính", icon: ChartColumn },
  { slug: "uu-dai", value: "ƯU ĐÃI" as const, label: "Ưu đãi và điểm", icon: Ticket },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
  { slug: "ma-uu-dai", value: "MÃ ƯU ĐÃI" as const, label: "Mã ưu đãi", icon: Ticket },
];

export default function RetailWorkspace() {
  const { userProfile } = useAuth();
  const canOpenPos = userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.some((permission) => ["*", "pos:manage", "retail:manage"].includes(permission)));
  const allowed = getAllowedRetailTabSlugs(
    userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || [],
  );
  const tabs = SUB_TABS.filter((tab) => allowed.includes(tab.slug as (typeof allowed)[number]));
  const [activeTab, setActiveTab] = useSubTabRouter<RetailSubTab>(tabs, tabs[0]?.value || "BÁN HÀNG");

  const openPos = () => {
    window.history.pushState(null, "", "/pos");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (!tabs.length) {
    return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng này.</div>;
  }

  const overviewSections = tabs.filter((tab: (typeof SUB_TABS)[number]) =>
    ["don-hang", "doi-tra", "hoa-don", "bao-cao", "ca-pos"].includes(tab.slug),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="px-4 pt-3.5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý bán hàng</h1>
            <p className="text-sm text-slate-500">Theo dõi đơn hàng, đổi trả, hóa đơn, báo cáo và ca POS.</p>
          </div>
          {canOpenPos && <button type="button" onClick={openPos} className="inline-flex items-center gap-2 rounded-xl bg-[#0866f5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0758d5]"><Store className="h-4 w-4" />Mở quầy POS<ArrowUpRight className="h-4 w-4" /></button>}
        </div>
        <ModuleNavigation label="Mục Bán hàng" activeValue={activeTab}>
          {tabs.map(tab => <ModuleNavigationButton key={tab.slug} active={activeTab === tab.value} icon={<tab.icon />} onClick={() => setActiveTab(tab.value)}>{tab.label}</ModuleNavigationButton>)}
        </ModuleNavigation>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải phân hệ bán hàng...</div>}>
          {activeTab === "BÁN HÀNG" && <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-lg font-semibold text-slate-900">Tổng quan bán hàng</h2>
              <p className="mt-1 text-sm text-slate-500">Chọn khu vực cần quản lý để xem dữ liệu và xử lý công việc.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {overviewSections.map((tab: (typeof SUB_TABS)[number]) => {
                const Icon = tab.icon;
                return <button key={tab.slug} type="button" onClick={() => setActiveTab(tab.value as RetailSubTab)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-blue-200 hover:shadow-sm">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#edf3ff] to-[#f5f0ff] text-[#0866f5]"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 font-semibold text-slate-800">{tab.label}</span>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#0866f5]" />
                </button>;
              })}
            </div>
          </section>}
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "ĐỔI TRẢ" && <ReturnsPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "CA POS" && <ShiftWorkspace />}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
          {activeTab === "MÃ ƯU ĐÃI" && <CouponsPage />}
          {activeTab === "TÀI CHÍNH" && <FinancePage />}
          {activeTab === "ƯU ĐÃI" && <PromotionsPage />}
          {activeTab === "BẢO HÀNH" && <OrderWarrantyPage />}
        </Suspense>
      </div>
    </div>
  );
}
