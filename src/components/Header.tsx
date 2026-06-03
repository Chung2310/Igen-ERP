import React, { useState } from "react";
import { Search, Bell, Sparkles, User, Settings, CheckCircle, LogOut } from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
}

export default function Header({ currentTab, onSearchSelect }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Match pages/sections for quick omni-search
  const searchIndex = [
    { label: "Tổng quan Doanh nghiệp", tab: "TỔNG QUAN" as TabType, keywords: "tong quan dashboard kpi hieu suat bieu do" },
    { label: "Sơ đồ tổ chức (Nhân sự)", tab: "NHÂN SỰ" as TabType, subTab: "SƠ ĐỒ TỔ CHỨC", keywords: "hr so do to chuc nhan su phong ban" },
    { label: "Giao việc Kanban (Nhân sự)", tab: "NHÂN SỰ" as TabType, subTab: "GIAO VIỆC KANBAN", keywords: "hr giao viec kanban task list cong viec" },
    { label: "Đào tạo e-Learning (Nhân sự)", tab: "NHÂN SỰ" as TabType, subTab: "ĐÀO TẠO", keywords: "onboarding hoc tap dao tao kien thuc video" },
    { label: "Danh mục Kho & Sản phẩm", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DANH MỤC", keywords: "kho hang san pham price danh muc gia ban" },
    { label: "Nhập / Xuất kho hàng", tab: "KHO & SẢN PHẨM" as TabType, subTab: "NHẬP / XUẤT KHO", keywords: "nhap kho xuat kho phieu nhap phieu xuat chung tu" },
    { label: "Dự báo AI & Cảnh báo hết hàng", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DỰ BÁO AI", keywords: "ai forecast dự báo nhu cầu dell xps screen canh bao" },
    { label: "Lên ý tưởng AI (Marketing)", tab: "MARKETING" as TabType, subTab: "LÊN Ý TƯỞNG AI", keywords: "viet content y tuong campaign facebook tiktok copywriter" },
    { label: "Duyệt nội dung Marketing", tab: "MARKETING" as TabType, subTab: "DUYỆT NỘI DUNG", keywords: "duyet content post facebook linkedin tiktok" },
    { label: "Lịch đăng tải Content", tab: "MARKETING" as TabType, subTab: "LỊCH ĐĂNG CONTENT", keywords: "lich dang content calendar calendar content publish" },
    { label: "Phễu Khách hàng (Sales CRM)", tab: "SALES CRM" as TabType, subTab: "PHỄU KHÁCH HÀNG", keywords: "crm phieu khach hang lead kaban cold warm hot" },
    { label: "Omni-Inbox Chat (Sales CRM)", tab: "SALES CRM" as TabType, subTab: "OMNI-INBOX CHAT", keywords: "chat vip box nguyen thi mai mailbox chat tro ly ai" },
    { label: "Phân tích hiệu suất AI", tab: "HIỆU SUẤT AI" as TabType, keywords: "analytics chart comparison workload bot human" },
  ];

  const filteredResults = searchQuery.trim() === "" 
    ? [] 
    : searchIndex.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const notifications = [
    { id: 1, text: "⚠️ Laptop Dell XPS 15 sắp hết hàng trong 3 ngày tới!", type: "alert", time: "5 phút trước" },
    { id: 2, text: "📬 Tin nhắn mới từ khách VIP Nguyễn Thị Mai", type: "message", time: "10 phút trước" },
    { id: 3, text: "✍️ AI Copywriter vừa tạo bản nháp mới chờ duyệt", type: "content", time: "1 giờ trước" },
  ];

  return (
    <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs" id="app_header">
      {/* Search Input Section */}
      <div className="relative w-96" id="search_container">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm nhanh trong iGen ERP..."
          className="block w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all font-sans"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          id="global_search_input"
        />
        
        {/* Search Results Dropdown */}
        {showResults && searchQuery.trim() !== "" && (
          <div className="absolute left-0 mt-2 w-full bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden z-50 font-sans text-xs">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider">
              Kết quả tìm kiếm ({filteredResults.length})
            </div>
            {filteredResults.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                {filteredResults.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onSearchSelect(item.tab, item.subTab);
                      setSearchQuery("");
                      setShowResults(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex flex-col gap-1 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-semibold text-gray-700 text-sm">{item.label}</span>
                    <span className="text-gray-400 text-[10px]">Tab chính: {item.tab} {item.subTab ? `› ${item.subTab}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Không tìm thấy phân mục nào phù hợp với từ khóa!
              </div>
            )}
            <div className="p-2 bg-gray-50 border-t border-gray-100 text-center text-[10px] text-gray-400">
              Nhấn ESC hoặc click ra ngoài để đóng
            </div>
          </div>
        )}
        {showResults && (
          <div 
            className="fixed inset-0 z-[-1]" 
            onClick={() => setShowResults(false)}
          />
        )}
      </div>

      {/* Header Utilities */}
      <div className="flex items-center gap-4" id="header_controls">
        {/* Dynamic State Info */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-200 text-green-700 text-xs font-medium uppercase font-mono">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span>Hệ thống hoạt động</span>
        </div>

        {/* AI Action Sparkles */}
        <div className="flex items-center gap-1 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg font-medium">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-xs md:text-sm">iGen AI Copilot Active</span>
        </div>

        {/* Notifications Icon with simulation state */}
        <div className="relative" id="notification_dropdown_button">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-gray-100 rounded-lg relative text-gray-600 active:scale-95 transition-all"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 font-sans overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="font-bold text-gray-800 text-sm">Cảnh báo hệ thống</span>
                <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">Đánh dấu đã đọc</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-4 hover:bg-gray-50/50 flex flex-col gap-1 text-xs">
                    <p className="text-gray-700 font-medium leading-relaxed">{n.text}</p>
                    <span className="text-gray-400 font-mono text-[10px]">{n.time}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 text-center border-t border-gray-100 bg-gray-50">
                <button className="text-xs text-gray-500 hover:text-blue-600 font-medium w-full">Xem tất cả thông báo</button>
              </div>
            </div>
          )}
          {showNotifications && (
            <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)} />
          )}
        </div>

        {/* Profile */}
        <div className="relative" id="user_profile_container">
          <div 
            className="flex items-center gap-3 pl-4 border-l border-gray-200 cursor-pointer select-none group active:scale-98 transition-transform" 
            id="user_profile_box"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="hidden lg:block text-right">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                {userProfile ? userProfile.displayName : "iGen Administrator"}
              </p>
            </div>
            {userProfile?.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt={userProfile.displayName} 
                className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-md ring-2 ring-blue-50 group-hover:ring-blue-100 transition-all"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-md ring-2 ring-blue-50 group-hover:ring-blue-100 transition-all select-none">
                {userProfile ? userProfile.displayName.slice(0, 2).toUpperCase() : "AD"}
              </div>
            )}
          </div>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-200 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                <div className="px-4 py-2.5 border-b border-gray-100/80">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tài khoản</p>
                  <p className="text-sm font-bold text-gray-800 truncate mt-0.5">{userProfile?.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{userProfile?.email}</p>
                  {userProfile?.role && (
                    <span className="inline-block mt-1 px-1.5 py-0.25 rounded-md font-mono font-bold text-[8px] uppercase bg-blue-50 text-blue-600 border border-blue-100">
                      {userProfile.role}
                    </span>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      onSearchSelect("CÀI ĐẶT" as TabType);
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-blue-50/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span>Cài đặt cá nhân</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowProfileMenu(false);
                      await logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50/80 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-50 mt-1 pt-2"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>Đăng xuất hệ thống</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
