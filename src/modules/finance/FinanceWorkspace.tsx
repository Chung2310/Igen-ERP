import { useMemo, useState } from "react";
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
  | "CÔNG NỢ"
  | "TUỔI NỢ"
  | "NHẮC NỢ"
  | "TÀI SẢN"
  | "KHẤU HAO"
  | "KIỂM KÊ";
export const FINANCE_SUB_TABS = [
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
  const permissions =
    userProfile?.role === "admin" || userProfile?.role === "superadmin"
      ? ["*"]
      : userProfile?.permissions || [];
  const allowedSlugs = useMemo(
    () => getAllowedFinanceTabSlugs(permissions),
    [permissions],
  );
  const tabs = useMemo(
    () => FINANCE_SUB_TABS.filter((tab) => allowedSlugs.includes(tab.slug)),
    [allowedSlugs],
  );
  const fallback =
    resolveFinanceSubTab(window.location.search, allowedSlugs) || "CÔNG NỢ";
  const [activeTab, setActiveTab] = useSubTabRouter<FinanceSubTab>(
    tabs as any,
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
      <div className="p-6 text-sm font-semibold text-amber-800">
        Bạn chưa được cấp quyền sử dụng chức năng tài chính.
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-4 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold ${activeTab === tab.value ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-cyan-50"}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === "CÔNG NỢ" && (
          <ReceivablesPage
            key={refreshKey}
            permissions={permissions}
            onOpen={setSelectedId}
          />
        )}{" "}
        {activeTab === "TUỔI NỢ" && <AgingReportPage onDrillDown={drillDown} />}{" "}
        {activeTab === "NHẮC NỢ" && (
          <FinanceRemindersPage permissions={permissions} />
        )}{" "}
        {activeTab === "TÀI SẢN" && <FixedAssetsPage permissions={permissions} />}{" "}
        {activeTab === "KHẤU HAO" && (
          <AssetDepreciationPage permissions={permissions} />
        )}{" "}
        {activeTab === "KIỂM KÊ" && (
          <AssetInventoryPage permissions={permissions} />
        )}
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
