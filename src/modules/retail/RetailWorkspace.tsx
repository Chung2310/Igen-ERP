import { lazy, Suspense } from "react";
import { BellRing, ChartColumn, FileText, ListOrdered, MonitorSmartphone, Settings, Store, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

const CustomersPage = lazy(() => import("./pages/RetailCustomersPage"));
const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const PosPage = lazy(() => import("./pages/RetailPosPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPage"));
const ShiftsPage = lazy(() => import("./pages/RetailShiftsPage"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const DebtRemindersPage = lazy(() => import("./pages/RetailDebtRemindersPage"));

type RetailSubTab = "BÁN HÀNG" | "ĐƠN HÀNG" | "CA BÁN HÀNG" | "HÓA ĐƠN" | "BÁO CÁO" | "KHÁCH HÀNG" | "NHẮC CÔNG NỢ" | "CÀI ĐẶT";
const SUB_TABS = [
  { slug: "ban-hang", value: "BÁN HÀNG" as const, label: "Bán hàng", icon: Store },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "ca-ban-hang", value: "CA BÁN HÀNG" as const, label: "Ca bán hàng", icon: MonitorSmartphone },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
  { slug: "khach-hang", value: "KHÁCH HÀNG" as const, label: "Khách hàng", icon: Users },
  { slug: "nhac-cong-no", value: "NHẮC CÔNG NỢ" as const, label: "Nhắc công nợ", icon: BellRing },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
];

export default function RetailWorkspace() {
  const { userProfile } = useAuth();
  const allowed = getAllowedRetailTabSlugs(
    userProfile?.role === "admin" || userProfile?.role === "superadmin"
      ? ["*"]
      : userProfile?.permissions || [],
  );
  const tabs = SUB_TABS.filter((tab) => allowed.includes(tab.slug as (typeof allowed)[number]));
  const [activeTab, setActiveTab] = useSubTabRouter<RetailSubTab>(tabs, tabs[0]?.value || "BÁN HÀNG");

  if (!tabs.length) {
    return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng này.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-4 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.value;
          return (
            <button key={tab.slug} type="button" onClick={() => setActiveTab(tab.value)} className={`flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold ${active ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-cyan-50"}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-slate-500">Đang tải phân hệ bán lẻ...</div>}>
          {activeTab === "BÁN HÀNG" && <PosPage />}
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "CA BÁN HÀNG" && <ShiftsPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "KHÁCH HÀNG" && <CustomersPage />}
          {activeTab === "NHẮC CÔNG NỢ" && <DebtRemindersPage />}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
        </Suspense>
      </div>
    </div>
  );
}
