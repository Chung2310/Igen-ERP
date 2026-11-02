import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import type { TabType, UserProfile } from "../types";
import { getRouteByTab, retryRoute } from "./route-config";

export function AppRouterView({ activeTab, userProfile, remountKey = 0, scopeKey = '' }: {
  activeTab: TabType;
  userProfile: UserProfile;
  remountKey?: number;
  scopeKey?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const route = getRouteByTab(activeTab);
  if (route.canAccess && !route.canAccess(userProfile)) return <PageLoader label="Bạn không có quyền truy cập khu vực này." />;
  const PageComponent = route.component;
  const retry = () => { retryRoute(activeTab); setAttempt((value) => value + 1); };
  const key = JSON.stringify([activeTab, userProfile.uid, userProfile.companyCode, scopeKey, remountKey, attempt]);
  return <RouteErrorBoundary key={key} onRetry={retry}>
    <Suspense fallback={<RoutePending onRetry={retry} />}>
      <PageComponent key={key} />
    </Suspense>
  </RouteErrorBoundary>;
}

class RouteErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <RouteRecovery title="Chưa thể hiển thị phân hệ" message="Mạng có thể bị gián đoạn hoặc ứng dụng đã có phiên bản mới. Bạn có thể thử lại hoặc chọn phân hệ khác trên thanh điều hướng." onRetry={this.props.onRetry} />;
  }
}
function RoutePending({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 20000); return () => clearTimeout(timer); }, []);
  return slow ? <RouteRecovery title="Tải phân hệ lâu hơn dự kiến" message="Kiểm tra kết nối rồi thử lại. Bạn vẫn có thể chọn phân hệ khác trên thanh điều hướng." onRetry={onRetry} /> : <PageLoader label="Đang tải trang..." />;
}
function RouteRecovery({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <section className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface">
    <h1 className="text-balance text-lg font-semibold">{title}</h1>
    <p role="alert" className="text-pretty text-sm text-on-surface-variant [--color-on-surface-variant:var(--color-slate-600)]">{message}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử lại phân hệ</button>
      <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tải phiên bản mới</button>
    </div>
  </section>;
}
function PageLoader({ label }: { label: string }) {
  return <div role="status" className="flex min-h-80 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm font-semibold text-on-surface-variant [--color-on-surface-variant:var(--color-slate-600)]">{label}</div>;
}
