import React, { useState } from "react";
import Sidebar from "./pages/Sidebar";
import Header from "./pages/Header";
import DashboardTab from "./pages/DashboardTab";
import HRTab from "./pages/HRTab";
import InventoryTab from "./pages/InventoryTab";
import MarketingTab from "./pages/MarketingTab";
import CRMTab from "./pages/CRMTab";
import UserAdminTab from "./pages/UserAdminTab";
import SettingsTab from "./pages/SettingsTab";
import { TabType } from "./types";
import { ToastContainer } from "./pages/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import { RefreshCw } from "lucide-react";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("TỔNG QUAN");
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] flex flex-col items-center justify-center text-center relative overflow-hidden font-sans">
        {/* Background Decorative Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-400/5 blur-[120px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center">
          <RefreshCw className="h-10 w-10 text-blue-600 animate-spin mb-4" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
            Đang khởi tạo hệ thống ERP...
          </span>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthPage />;
  }

  // Handlers for cross-linking navigation search queries from the Omni-Search Header
  const handleSearchNavigation = (tab: TabType, subTab?: string) => {
    setActiveTab(tab);
    // Custom global triggers can optionally notify components if ref/context is used
    console.log(`Global Navigation search redirected to Tab: ${tab}, Section: ${subTab || "None"}`);
  };

  return (
    <div className="flex h-screen w-screen bg-background text-on-surface overflow-hidden font-sans" id="app_root_layout">
      {/* Dynamic Left Sidebar Section */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden" id="main_content_area">
        {/* Top Header Utilities search bar */}
        <Header currentTab={activeTab} onSearchSelect={handleSearchNavigation} />

        {/* Primary Page Canvas */}
        <main className="flex-1 p-6 overflow-hidden bg-surface" id="primary_page_container">
          {activeTab === "TỔNG QUAN" && <DashboardTab />}
          {activeTab === "NHÂN SỰ" && <HRTab />}
          {activeTab === "KHO & SẢN PHẨM" && <InventoryTab />}
          {activeTab === "MARKETING" && <MarketingTab />}
          {activeTab === "SALES CRM" && <CRMTab />}
          {activeTab === "QUẢN TRỊ USER" && (userProfile.role === "superadmin" || userProfile.role === "admin") && <UserAdminTab />}
          {activeTab === "CÀI ĐẶT" && <SettingsTab />}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
