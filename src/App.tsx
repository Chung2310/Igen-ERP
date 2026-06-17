import React, { Suspense, lazy } from "react";
import { RefreshCw } from "lucide-react";
import Sidebar from "./pages/Sidebar";
import Header from "./pages/Header";
import { ToastContainer } from "./pages/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import type { TabType } from "./types";
import { SEOHead } from "./seo/SEOHead";
import { AUTH_SEO, getSeoForTab } from "./seo/seo-config";
import { AppRouterView, useTabRouter } from "./router";
import { socketService } from "./services/socketService";

const AuthPage = lazy(() => import("./pages/AuthPage"));

function AppContent() {
  const { activeTab, setActiveTab } = useTabRouter();
  const { user, userProfile, loading } = useAuth();

  React.useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (user && token) {
      console.log("[App] Connecting global socket...");
      socketService.connect(token);
    } else {
      console.log("[App] Disconnecting global socket...");
      socketService.disconnect();
    }
  }, [user]);

  if (loading) {
    return (
      <>
        <SEOHead meta={{ ...AUTH_SEO, title: "Đang tải hệ thống iGen ERP", path: "/khoi-tao-he-thong" }} />
        <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] text-center font-sans">
          <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-blue-400/5 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-400/5 blur-[120px]" />

          <div className="z-10 flex flex-col items-center">
            <RefreshCw className="mb-4 h-10 w-10 animate-spin text-blue-600" />
            <span className="animate-pulse text-xs font-bold uppercase tracking-widest text-slate-500">
              Đang khởi tạo hệ thống ERP...
            </span>
          </div>
        </div>
      </>
    );
  }

  if (!user || !userProfile) {
    return (
      <>
        <SEOHead meta={AUTH_SEO} />
        <Suspense fallback={<AuthLoader />}>
          <AuthPage />
        </Suspense>
      </>
    );
  }

  const handleSearchNavigation = (tab: TabType, subTab?: string) => {
    setActiveTab(tab);
    console.log(`Global Navigation search redirected to Tab: ${tab}, Section: ${subTab || "None"}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans text-on-surface" id="app_root_layout">
      <SEOHead meta={getSeoForTab(activeTab)} />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex h-screen flex-1 flex-col overflow-hidden" id="main_content_area">
        <Header currentTab={activeTab} onSearchSelect={handleSearchNavigation} />

        <main className="flex-1 overflow-hidden bg-surface p-6" id="primary_page_container">
          <AppRouterView activeTab={activeTab} userProfile={userProfile} />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer />
    </AuthProvider>
  );
}

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] text-sm font-semibold text-slate-500">
      Đang tải trang đăng nhập...
    </div>
  );
}
