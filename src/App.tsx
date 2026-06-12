import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Sidebar from "./pages/Sidebar";
import Header from "./pages/Header";
import DashboardTab from "./pages/DashboardTab";
import HRTab from "./pages/HRTab";
import InventoryTab from "./pages/InventoryTab";
import MarketingTab from "./pages/MarketingTab";
import CRMTab from "./pages/CRMTab";
import UserAdminTab from "./pages/UserAdminTab";
import SettingsTab from "./pages/SettingsTab";
import AIPerformanceTab from "./pages/AIPerformanceTab";
import { ToastContainer } from "./pages/Toast";
import AuthPage from "./pages/AuthPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import type { TabType } from "./types";
import { SEOHead } from "./seo/SEOHead";
import { AUTH_SEO, getSeoForTab, pathToTab, tabToPath } from "./seo/seo-config";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("TỔNG QUAN");
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    const initialTab = pathToTab(window.location.pathname);
    if (initialTab) {
      setActiveTab(initialTab);
    }

    const handlePopState = () => {
      const nextTab = pathToTab(window.location.pathname);
      if (nextTab) {
        setActiveTab(nextTab);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const nextPath = tabToPath(activeTab);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, [activeTab]);

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
        <AuthPage />
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
          {activeTab === "TỔNG QUAN" && <DashboardTab />}
          {activeTab === "NHÂN SỰ" && <HRTab />}
          {activeTab === "KHO & SẢN PHẨM" && <InventoryTab />}
          {activeTab === "MARKETING" && <MarketingTab />}
          {activeTab === "SALES CRM" && <CRMTab />}
          {activeTab === "HIỆU SUẤT AI" && <AIPerformanceTab />}
          {activeTab === "QUẢN TRỊ USER" && (userProfile.role === "superadmin" || userProfile.role === "admin") && (
            <UserAdminTab />
          )}
          {activeTab === "CÀI ĐẶT" && <SettingsTab />}
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
