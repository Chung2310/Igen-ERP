import { lazy, Suspense, useEffect, useState } from "react";
import { ChartColumn, FileText, ListOrdered, MonitorSmartphone, RotateCcw, Settings, ShieldCheck, Store, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";
import type { RepairCreatePrefill } from "../repair/RepairBoardPage";

const SettingsPage = lazy(() => import("./pages/RetailSettingsPage"));
const PosPage = lazy(() => import("./pages/RetailPosPage"));
const OrdersPage = lazy(() => import("./pages/RetailOrdersPageV2"));
const ReturnsPage = lazy(() => import("./pages/RetailReturnsPage"));
const ShiftsPage = lazy(() => import("./pages/RetailShiftsPage"));
const InvoicesPage = lazy(() => import("./pages/RetailInvoicesPageContent"));
const ReportsPage = lazy(() => import("./pages/RetailReportsPage"));
const WarrantyLookupPage = lazy(() => import("./pages/WarrantyLookupPage"));
const RepairBoardPage = lazy(() => import("../repair/RepairBoardPage"));
const PromotionsPage = lazy(() => import("./pages/RetailPromotionsPage"));
const FinancePage = lazy(() => import("./pages/RetailFinancePage"));

type RetailSubTab = "BẢO HÀNH" | "BÁN HÀNG" | "ĐƠN HÀNG" | "ĐỔI TRẢ" | "CA BÁN HÀNG" | "HÓA ĐƠN" | "BÁO CÁO" | "TÀI CHÍNH" | "ƯU ĐÃI" | "CÀI ĐẶT";

const SUB_TABS = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as const, label: "Bảo hành", icon: ShieldCheck },
  { slug: "ban-hang", value: "BÁN HÀNG" as const, label: "Bán hàng", icon: Store },
  { slug: "don-hang", value: "ĐƠN HÀNG" as const, label: "Đơn hàng", icon: ListOrdered },
  { slug: "doi-tra", value: "ĐỔI TRẢ" as const, label: "Đổi trả", icon: RotateCcw },
  { slug: "ca-ban-hang", value: "CA BÁN HÀNG" as const, label: "Ca bán hàng", icon: MonitorSmartphone },
  { slug: "hoa-don", value: "HÓA ĐƠN" as const, label: "Hóa đơn", icon: FileText },
  { slug: "bao-cao", value: "BÁO CÁO" as const, label: "Báo cáo", icon: ChartColumn },
  { slug: "tai-chinh", value: "TÀI CHÍNH" as const, label: "Tài chính", icon: Wallet },
  { slug: "uu-dai", value: "ƯU ĐÃI" as const, label: "Ưu đãi", icon: ShieldCheck },
  { slug: "cai-dat", value: "CÀI ĐẶT" as const, label: "Cài đặt", icon: Settings },
];

export default function RetailWorkspace() {
  const [repairPrefill, setRepairPrefill] = useState<RepairCreatePrefill | null>(null);
  const [repairVisible, setRepairVisible] = useState(false);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  const canManageWarranty = isAdmin || Boolean(userProfile?.permissions?.includes("retail:manage") || userProfile?.permissions?.includes("repair:manage") || userProfile?.permissions?.includes("*"));
  const canCreateRepair = isAdmin || Boolean(userProfile?.permissions?.includes("repair:manage") || userProfile?.permissions?.includes("*"));
  const allowed = getAllowedRetailTabSlugs(
    userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || [],
  );
  const tabs: any = SUB_TABS.filter((tab) => allowed.includes(tab.slug as (typeof allowed)[number]));
  const canOpenSettings = allowed.includes("cai-dat");
  const [activeTab, setActiveTab] = useSubTabRouter<RetailSubTab>(tabs, tabs[0]?.value || "BÁN HÀNG");
  const [posOpen, setPosOpen] = useState(() => new URLSearchParams(window.location.search).get("pos") === "1" || activeTab === "BÁN HÀNG");
  useEffect(() => {
    const syncPosFromUrl = () => setPosOpen(new URLSearchParams(window.location.search).get("pos") === "1");
    window.addEventListener("popstate", syncPosFromUrl);
    return () => window.removeEventListener("popstate", syncPosFromUrl);
  }, []);
  const setPosVisible = (open: boolean) => {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set("pos", "1"); else url.searchParams.delete("pos");
    window.history.replaceState(null, "", url.toString());
    setPosOpen(open);
  };

  if (!tabs.length) {
    return <div className="p-6 text-sm font-semibold text-on-surface">Bạn chưa được cấp quyền sử dụng chức năng này.</div>;
  }

  if (posOpen) {
    return <Suspense fallback={<div role="status">Đang mở quầy bán hàng...</div>}><PosPage onLeavePos={() => { setPosVisible(false); setActiveTab("ĐƠN HÀNG"); }} onManageShift={() => { setPosVisible(false); setActiveTab("CA BÁN HÀNG"); }} onPrinterSettings={canOpenSettings ? () => { setPosVisible(false); setActiveTab("CÀI ĐẶT"); } : undefined} /></Suspense>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex gap-1 overflow-x-auto border-b border-outline-variant bg-surface-container-lowest px-4 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.slug}
              type="button"
              aria-pressed={active}
              onClick={() => { setActiveTab(tab.value); if (tab.value === "BÁN HÀNG") setPosVisible(true); }}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Suspense fallback={<div role="status" className="text-sm text-on-surface-variant">Đang tải phân hệ bán lẻ...</div>}>
          {activeTab === "ĐƠN HÀNG" && <OrdersPage />}
          {activeTab === "ĐỔI TRẢ" && <ReturnsPage onOpenOrders={() => setActiveTab("ĐƠN HÀNG")} />}
          {activeTab === "CA BÁN HÀNG" && <ShiftsPage />}
          {activeTab === "HÓA ĐƠN" && <InvoicesPage />}
          {activeTab === "BÁO CÁO" && <ReportsPage />}
          {activeTab === "TÀI CHÍNH" && <FinancePage />}
          {activeTab === "ƯU ĐÃI" && <PromotionsPage />}
          {activeTab === "CÀI ĐẶT" && <SettingsPage />}
          {activeTab === "BẢO HÀNH" && (repairVisible ? (
            <div className="space-y-4">
              <button type="button" onClick={() => { setRepairVisible(false); setRepairPrefill(null); }} className="min-h-11 rounded-lg border border-outline px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Quay lại tra cứu bảo hành</button>
              <RepairBoardPage createPrefill={repairPrefill} onCreatePrefillConsumed={() => setRepairPrefill(null)} />
            </div>
          ) : <WarrantyLookupPage canManage={canManageWarranty} onCreateRepair={canCreateRepair ? (device) => { setRepairPrefill(device); setRepairVisible(true); } : undefined} />)}
        </Suspense>
      </div>
    </div>
  );
}
