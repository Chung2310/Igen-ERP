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
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import AuthPage from "./pages/AuthPage";
import { RefreshCw } from "lucide-react";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("TỔNG QUAN");
  const { user, userProfile, loading } = useAuth();
  const { dark } = useTheme();

 if (loading) {
  return (
    <div className="w-screen h-screen bg-gray-50 flex flex-col items-center justify-center text-center">
      <RefreshCw className="h-10 w-10 text-[#00b2cb] animate-spin mb-4" />
      <span className="text-xs font-bold font-sans text-gray-500 uppercase tracking-widest animate-pulse">
        Đang khởi tạo hệ thống ERP...
      </span>
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
    <div className={`flex h-screen w-screen overflow-hidden font-sans ${dark ? "bg-black text-slate-100" : "bg-white text-slate-950"}`} id="app_root_layout">
      {/* Dynamic Left Sidebar Section */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden" id="main_content_area">
        {/* Top Header Utilities search bar */}
        <Header currentTab={activeTab} onSearchSelect={handleSearchNavigation} />

        {/* Primary Page Canvas */}
        <main className={`flex-1 p-6 overflow-hidden ${dark ? "bg-black" : "bg-white"}`} id="primary_page_container">
          {activeTab === "TỔNG QUAN" && <DashboardTab />}
          {activeTab === "NHÂN SỰ" && <HRTab />}
          {activeTab === "KHO & SẢN PHẨM" && <InventoryTab />}
          {activeTab === "MARKETING" && <MarketingTab />}
          {activeTab === "SALES CRM" && <CRMTab />}
          {activeTab === "QUẢN TRỊ USER" && (userProfile.role === "superadmin" || userProfile.role === "admin") && <UserAdminTab />}
          {activeTab === "CÀI ĐẶT" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastContainer />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
