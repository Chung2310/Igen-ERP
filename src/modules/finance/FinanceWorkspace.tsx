import FinancialManagementPage from "./pages/FinancialManagementPage";
import DebtManagementPanel from "./pages/DebtManagementPanel";
import TreasuryPage from "./pages/TreasuryPage";
import { useMemo, useState } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { BellRing, Boxes, ChartNoAxesColumnIncreasing, ClipboardCheck, Landmark, TrendingDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import type { AgingBucket } from "./api/financeReceivables.api";
import ReceivableDetailDrawer from "./components/ReceivableDetailDrawer";
import AgingReportPage from "./pages/AgingReportPage";
import AssetDepreciationPage from "./pages/AssetDepreciationPage";
import AssetInventoryPage from "./pages/AssetInventoryPage";
import FixedAssetsPage from "./pages/FixedAssetsPage";
import FinanceRemindersPage from "./pages/FinanceRemindersPage";
import ReceivablesPage from "./pages/ReceivablesPage";

type FinanceSubTab =
  | "TỔNG QUAN"
  | "THU CHI"
  | "LÃI LỖ"
  | "VAT"
  | "HÒA VỐN"
  | "SỔ QUỸ"
  | "CÔNG NỢ"
  | "TUỔI NỢ"
  | "NHẮC NỢ"
  | "TÀI SẢN"
  | "KHẤU HAO"
  | "KIỂM KÊ";

export const FINANCE_SUB_TABS = [
  { slug: "tong-quan", value: "TỔNG QUAN" as const, label: "Tổng quan", icon: ChartNoAxesColumnIncreasing },
  { slug: "thu-chi", value: "THU CHI" as const, label: "Thu - Chi", icon: Landmark },
  { slug: "lai-lo", value: "LÃI LỖ" as const, label: "Lãi lỗ", icon: TrendingDown },
  { slug: "vat", value: "VAT" as const, label: "VAT", icon: Landmark },
  { slug: "hoa-von", value: "HÒA VỐN" as const, label: "Hòa vốn", icon: ChartNoAxesColumnIncreasing },
  { slug: "so-quy", value: "SỔ QUỸ" as const, label: "Sổ quỹ & dòng tiền", icon: Landmark },
  {
    slug: "cong-no",
    value: "CÔNG NỢ" as const,
    label: "Công nợ",
    icon: Landmark,
  },
  {
    slug: "tuoi-no",
    value: "TUỔI NỢ" as const,
    label: "Tuổi nợ",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    slug: "nhac-no",
    value: "NHẮC NỢ" as const,
    label: "Nhắc nợ",
    icon: BellRing,
  },
  {
    slug: "tai-san",
    value: "TÀI SẢN" as const,
    label: "Tài sản",
    icon: Boxes,
  },
  {
    slug: "khau-hao",
    value: "KHẤU HAO" as const,
    label: "Khấu hao",
    icon: TrendingDown,
  },
  {
    slug: "kiem-ke",
    value: "KIỂM KÊ" as const,
    label: "Kiểm kê",
    icon: ClipboardCheck,
  },
] as const;

export function getAllowedFinanceTabSlugs(permissions: readonly string[] = []) {
  if (permissions.includes("*")) return FINANCE_SUB_TABS.map((tab) => tab.slug);
  const allowed: Array<(typeof FINANCE_SUB_TABS)[number]["slug"]> = [];
  if (permissions.includes("finance-wallet:manage")) {
    allowed.push("tong-quan", "thu-chi", "lai-lo", "vat", "hoa-von", "so-quy");
  } else if (permissions.includes("finance-wallet:read")) {
    allowed.push("so-quy");
  }
  const canReadReceivables = permissions.some((item) =>
    ["finance-receivable:read", "finance-receivable:manage"].includes(item),
  );
  if (canReadReceivables) allowed.push("cong-no", "tuoi-no", "nhac-no");
  const canReadAssets = permissions.some((item) =>
    ["asset:read", "asset:manage"].includes(item),
  );
  if (canReadAssets) allowed.push("tai-san", "khau-hao", "kiem-ke");
  return allowed;
}

export function resolveFinanceSubTab(
  search: string,
  allowed: readonly string[],
): FinanceSubTab | undefined {
  const slug = new URLSearchParams(search).get("sub");
  const match = FINANCE_SUB_TABS.find(
    (tab) => tab.slug === slug && allowed.includes(tab.slug),
  );
  return (
    match?.value ||
    FINANCE_SUB_TABS.find((tab) => allowed.includes(tab.slug))?.value
  );
}

export default function FinanceWorkspace() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  const permissions = useMemo(
    () => isAdmin ? ["*"] : userProfile?.permissions || [],
    [isAdmin, userProfile?.permissions],
  );
  const allowedSlugs = useMemo(
    () => getAllowedFinanceTabSlugs(permissions),
    [permissions],
  );
  const tabs = useMemo(
    () => FINANCE_SUB_TABS.filter((tab) => allowedSlugs.includes(tab.slug)),
    [allowedSlugs],
  );
  // Keep the URL selection while the profile and its permissions are loading.
  const routeTabs = tabs.length ? tabs : FINANCE_SUB_TABS;
  const fallback =
    resolveFinanceSubTab(window.location.search, allowedSlugs) || "CÔNG NỢ";
  const [activeTab, setActiveTab] = useSubTabRouter<FinanceSubTab>(
    routeTabs as any,
    fallback,
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const drillDown = (bucket: AgingBucket) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sub", "cong-no");
    url.searchParams.set("aging", bucket);
    window.history.replaceState(null, "", url);
    setActiveTab("CÔNG NỢ");
  };
  if (!tabs.length)
    return (
      <div className="p-6 text-sm font-semibold text-on-tertiary-container">
        Bạn chưa được cấp quyền sử dụng chức năng tài chính.
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-low">
      <ModuleNavigation label="Mục Tài chính" activeValue={activeTab} wheelScroll>
        {tabs.map(tab => <ModuleNavigationButton key={tab.slug} active={activeTab === tab.value} icon={<tab.icon />} onClick={() => setActiveTab(tab.value)}>{tab.label}</ModuleNavigationButton>)}
      </ModuleNavigation>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {(["TỔNG QUAN", "THU CHI", "LÃI LỖ", "VAT", "HÒA VỐN"].includes(activeTab)) && (
            <FinancialManagementPage
              key={activeTab}
              view={
                ({
                  "TỔNG QUAN": "overview",
                  "THU CHI": "cash",
                  "LÃI LỖ": "profit",
                  "VAT": "vat",
                  "HÒA VỐN": "breakeven",
                } as const)[activeTab as "TỔNG QUAN" | "THU CHI" | "LÃI LỖ" | "VAT" | "HÒA VỐN"]
              }
            />
          )}
          {activeTab === "SỔ QUỸ" && <TreasuryPage permissions={permissions} />}
          {(["CÔNG NỢ", "TUỔI NỢ", "NHẮC NỢ"].includes(activeTab)) && (
            <DebtManagementPanel
              key={activeTab + refreshKey}
              mode={activeTab === "CÔNG NỢ" ? "debt" : activeTab === "TUỔI NỢ" ? "aging" : "reminders"}
              permissions={permissions}
              onOpen={setSelectedId}
            />
          )}
          {activeTab === "CÔNG NỢ" && (
            <ReceivablesPage
              key={refreshKey}
              permissions={permissions}
              onOpen={setSelectedId}
            />
          )}{" "}
          {activeTab === "TUỔI NỢ" && <details className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><summary className="cursor-pointer text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Xem báo cáo tuổi nợ theo nhóm cũ</summary><AgingReportPage onDrillDown={drillDown} /></details>}{" "}
          {activeTab === "NHẮC NỢ" && (
            <details className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><summary className="cursor-pointer text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Xem lịch gửi nhắc nợ</summary><FinanceRemindersPage permissions={permissions} /></details>
          )}{" "}
          {activeTab === "TÀI SẢN" && <FixedAssetsPage permissions={permissions} />}{" "}
          {activeTab === "KHẤU HAO" && (
            <AssetDepreciationPage permissions={permissions} />
          )}{" "}
          {activeTab === "KIỂM KÊ" && (
            <AssetInventoryPage permissions={permissions} />
          )}
        </div>
      </div>
      {selectedId && (
        <ReceivableDetailDrawer
          id={selectedId}
          permissions={permissions}
          onClose={() => setSelectedId(undefined)}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  );
}
