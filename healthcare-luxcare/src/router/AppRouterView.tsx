import { Suspense } from "react";
import type { TabType, UserProfile } from "../types";
import { getRouteByTab } from "./route-config";

export function AppRouterView({
  activeTab,
  userProfile,
  remountKey = 0,
}: {
  activeTab: TabType;
  userProfile: UserProfile;
  /** Tăng giá trị này để remount trang hiện tại (bấm lại icon tab đang mở) */
  remountKey?: number;
}) {
  const route = getRouteByTab(activeTab);

  if (route?.canAccess && !route.canAccess(userProfile)) {
    return <PageLoader label="Bạn không có quyền truy cập khu vực này." />;
  }

  const PageComponent = route.component;

  return (
    <Suspense fallback={<PageLoader label="Đang tải trang..." />}>
      <PageComponent key={`${activeTab}-${remountKey}`} />
    </Suspense>
  );
}

function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">
      {label}
    </div>
  );
}
