import React, { useState } from "react";
import { Bell, LogOut, Plus, Search, Settings } from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
}

const searchIndex = [
  { label: "Tổng quan Doanh nghiệp", tab: "TỔNG QUAN" as TabType, keywords: "tong quan dashboard kpi hieu suat bieu do" },
  { label: "Sơ đồ tổ chức", tab: "NHÂN SỰ" as TabType, subTab: "SƠ ĐỒ TỔ CHỨC", keywords: "hr so do to chuc nhan su phong ban" },
  { label: "Giao việc Kanban", tab: "NHÂN SỰ" as TabType, subTab: "GIAO VIỆC KANBAN", keywords: "hr giao viec kanban task list cong viec" },
  { label: "Đào tạo e-Learning", tab: "NHÂN SỰ" as TabType, subTab: "ĐÀO TẠO", keywords: "onboarding hoc tap dao tao kien thuc video" },
  { label: "Danh mục Kho & Sản phẩm", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DANH MỤC", keywords: "kho hang san pham price danh muc gia ban" },
  { label: "Nhập / Xuất kho hàng", tab: "KHO & SẢN PHẨM" as TabType, subTab: "NHẬP / XUẤT KHO", keywords: "nhap kho xuat kho phieu nhap phieu xuat chung tu" },
  { label: "Dự báo AI & cảnh báo tồn kho", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DỰ BÁO AI", keywords: "ai forecast du bao nhu cau canh bao" },
  { label: "Lên ý tưởng AI Marketing", tab: "MARKETING" as TabType, subTab: "LÊN Ý TƯỞNG AI", keywords: "viet content y tuong campaign facebook tiktok copywriter" },
  { label: "Duyệt nội dung Marketing", tab: "MARKETING" as TabType, subTab: "DUYỆT NỘI DUNG", keywords: "duyet content post facebook linkedin tiktok" },
  { label: "Lịch đăng Content", tab: "MARKETING" as TabType, subTab: "LỊCH ĐĂNG CONTENT", keywords: "lich dang content calendar publish" },
  { label: "Phễu Khách hàng", tab: "SALES CRM" as TabType, subTab: "PHỄU KHÁCH HÀNG", keywords: "crm phieu khach hang lead cold warm hot" },
  { label: "Omni-Inbox Chat", tab: "SALES CRM" as TabType, subTab: "OMNI-INBOX CHAT", keywords: "chat vip mailbox tro ly ai" },
];

const notifications = [
  { id: 1, text: "Laptop Dell XPS 15 sắp hết hàng trong 3 ngày tới.", time: "5 phút trước" },
  { id: 2, text: "Tin nhắn mới từ khách VIP Nguyễn Thị Mai.", time: "10 phút trước" },
  { id: 3, text: "AI Copywriter vừa tạo bản nháp mới chờ duyệt.", time: "1 giờ trước" },
];

export default function Header({ currentTab, onSearchSelect }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResults =
    normalizedQuery === ""
      ? []
      : searchIndex.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.keywords.toLowerCase().includes(normalizedQuery)
        );

  return (
    <header className="sticky top-0 z-40 flex h-18 items-center justify-between border-b border-gray-100 bg-white px-6 shadow-xs" id="app_header">
      <div className="relative w-full max-w-2xl" id="search_container">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm trong ERP..."
          className="block h-12 w-full rounded-full border border-gray-200 bg-white pl-12 pr-5 text-sm text-gray-900 shadow-[0_8px_24px_rgba(15,23,42,0.05)] outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          id="global_search_input"
        />

        {showResults && searchQuery.trim() !== "" && (
          <div className="absolute left-0 z-50 mt-3 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans text-xs shadow-2xl">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Kết quả tìm kiếm ({filteredResults.length})
            </div>
            {filteredResults.length > 0 ? (
              <div className="max-h-72 overflow-y-auto">
                {filteredResults.map((item, index) => (
                  <button
                    key={`${item.label}_${index}`}
                    onClick={() => {
                      onSearchSelect(item.tab, item.subTab);
                      setSearchQuery("");
                      setShowResults(false);
                    }}
                    className="flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50/60"
                  >
                    <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                    <span className="text-[10px] text-gray-400">
                      {item.tab}
                      {item.subTab ? ` › ${item.subTab}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-gray-500">Không tìm thấy phân mục phù hợp.</div>
            )}
          </div>
        )}
        {showResults && <div className="fixed inset-0 z-[-1]" onClick={() => setShowResults(false)} />}
      </div>

      <div className="ml-6 flex items-center gap-3" id="header_controls">
        <button
          onClick={() => onSearchSelect(currentTab)}
          className="hidden items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-600 md:flex"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo mới</span>
        </button>

        <div className="relative" id="notification_dropdown_button">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl p-2.5 text-gray-600 transition-all hover:bg-gray-50 active:scale-95"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm font-bold text-gray-800">Thông báo</span>
                <button className="text-xs font-semibold text-blue-600 hover:underline">Đánh dấu đã đọc</button>
              </div>
              <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex flex-col gap-1 p-4 text-xs hover:bg-gray-50/70">
                    <p className="font-medium leading-relaxed text-gray-700">{notification.text}</p>
                    <span className="font-mono text-[10px] text-gray-400">{notification.time}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 bg-gray-50 p-3 text-center">
                <button className="w-full text-xs font-semibold text-gray-500 hover:text-blue-600">Xem tất cả thông báo</button>
              </div>
            </div>
          )}
          {showNotifications && <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifications(false)} />}
        </div>

        <div className="relative" id="user_profile_container">
          <div
            className="flex cursor-pointer select-none items-center gap-3 border-l border-gray-200 pl-4 transition-transform active:scale-98"
            id="user_profile_box"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="hidden text-right lg:block">
              <p className="text-sm font-semibold text-gray-800 transition-colors hover:text-blue-600">
                {userProfile ? userProfile.displayName : "iGen Administrator"}
              </p>
            </div>
            {userProfile?.photoURL && (userProfile.photoURL.startsWith("http") || userProfile.photoURL.startsWith("/")) ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="h-9 w-9 rounded-full border border-gray-200 object-cover shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100"
              />
            ) : (
              <div className="flex h-9 w-9 select-none items-center justify-center rounded-full bg-blue-600 text-sm font-bold tracking-wide text-white shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100">
                {userProfile ? userProfile.displayName.slice(0, 2).toUpperCase() : "AD"}
              </div>
            )}
          </div>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-gray-100 bg-white/95 py-2 font-sans shadow-2xl backdrop-blur-md">
                <div className="border-b border-gray-100 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tài khoản</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-gray-800">{userProfile?.displayName}</p>
                  <p className="truncate text-xs text-gray-500">{userProfile?.email}</p>
                  {userProfile?.role && (
                    <span className="mt-1 inline-block rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-blue-600">
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
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span>Cài đặt cá nhân</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowProfileMenu(false);
                      await logout();
                    }}
                    className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-t border-gray-50 px-3 py-2 pt-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50/80"
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
