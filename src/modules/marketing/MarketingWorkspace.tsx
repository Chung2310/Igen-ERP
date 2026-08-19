import { useMemo } from "react";
import { History, Settings2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubTabRouter } from "../../hooks/useSubTabRouter";
import MarketingAutomationSettingsPage from "./pages/MarketingAutomationSettingsPage";
import MarketingDeliveriesPage from "./pages/MarketingDeliveriesPage";

type MarketingSubTab = "CÀI ĐẶT TỰ ĐỘNG" | "NHẬT KÝ GỬI";

export const MARKETING_SUB_TABS = [
  { slug: "cai-dat", value: "CÀI ĐẶT TỰ ĐỘNG" as const, label: "Cài đặt tự động", icon: Settings2 },
  { slug: "nhat-ky", value: "NHẬT KÝ GỬI" as const, label: "Nhật ký gửi", icon: History },
] as const;

export function canManageMarketing(permissions: readonly string[] = []) {
  return permissions.includes("*") || permissions.includes("marketing:manage");
}

export function canReadMarketing(permissions: readonly string[] = []) {
  return canManageMarketing(permissions) || permissions.includes("marketing:read");
}

export default function MarketingWorkspace() {
  const { userProfile } = useAuth();
  const permissions = useMemo(
    () => (userProfile?.role === "admin" || userProfile?.role === "superadmin" ? ["*"] : userProfile?.permissions || []),
    [userProfile],
  );
  const [activeTab, setActiveTab] = useSubTabRouter<MarketingSubTab>(MARKETING_SUB_TABS as any, "CÀI ĐẶT TỰ ĐỘNG");
  const canManage = canManageMarketing(permissions);

  if (!canReadMarketing(permissions)) {
    return <div className="p-6 text-sm font-semibold text-amber-800">Bạn chưa được cấp quyền sử dụng chức năng marketing.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex gap-1 border-b border-slate-200 bg-white px-4 pt-3">
        {MARKETING_SUB_TABS.map((tab) => {
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
        {activeTab === "CÀI ĐẶT TỰ ĐỘNG" && <MarketingAutomationSettingsPage canManage={canManage} />}
        {activeTab === "NHẬT KÝ GỬI" && <MarketingDeliveriesPage canManage={canManage} />}
      </div>
    </div>
  );
}
