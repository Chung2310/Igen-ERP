/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Bell, LogOut, Search, Settings, Wallet, Info, X, Image, Video, Volume2, FileText,
  Package, Megaphone, Sparkles, CheckCheck, ShoppingCart, AlertTriangle, Send, Sun, Moon,
  Briefcase, GraduationCap, LayoutGrid, LayoutDashboard, Users, MessageSquareShare,
  FolderOpen, MessageSquare, Shield, LineChart, Menu, FolderTree, GitBranch, Calendar, Clock, User
} from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { walletService } from "../services/walletService";
import { isTabHidden } from "../config/modules";
import { toast } from "./Toast";
import { notificationService, WebNotification } from "../services/notificationService";
import { socketService } from "../services/socketService";

interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
  onMenuClick?: () => void;
}

const searchIndex = [
  { label: "Tổng quan Doanh nghiệp", tab: "TỔNG QUAN" as TabType, keywords: "tong quan dashboard kpi hieu suat bieu do" },
  { label: "Sơ đồ tổ chức", tab: "NHÂN SỰ" as TabType, subTab: "SƠ ĐỒ TỔ CHỨC", keywords: "hr so do to chuc nhan su phong ban" },
  { label: "Giao Việc", tab: "NHÂN SỰ" as TabType, subTab: "Giao Việc", keywords: "hr giao viec  task list cong viec" },
  { label: "Đào tạo e-Learning", tab: "NHÂN SỰ" as TabType, subTab: "ĐÀO TẠO", keywords: "onboarding hoc tap dao tao kien thuc video" },
  { label: "Danh mục Kho & Sản phẩm", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DANH MỤC", keywords: "kho hang san pham price danh muc gia ban" },
  { label: "Nhập / Xuất kho hàng", tab: "KHO & SẢN PHẨM" as TabType, subTab: "NHẬP / XUẤT KHO", keywords: "nhap kho xuat kho phieu nhap phieu xuat chung tu" },
  { label: "Dự báo AI & cảnh báo tồn kho", tab: "KHO & SẢN PHẨM" as TabType, subTab: "DỰ BÁO AI", keywords: "ai forecast du bao nhu cau canh bao" },
  { label: "Lên ý tưởng AI Marketing", tab: "MARKETING" as TabType, subTab: "LÊN Ý TƯỞNG AI", keywords: "viet content y tuong campaign facebook tiktok copywriter" },
  { label: "Duyệt nội dung Marketing", tab: "MARKETING" as TabType, subTab: "DUYỆT NỘI DUNG", keywords: "duyet content post facebook linkedin tiktok" },
  { label: "Lịch đăng Content", tab: "MARKETING" as TabType, subTab: "LỊCH ĐĂNG CONTENT", keywords: "lich dang content calendar publish" },
  { label: "Phễu Khách hàng", tab: "SALES CRM" as TabType, subTab: "PHỄU KHÁCH HÀNG", keywords: "crm phieu khach hang lead cold warm hot" },
  { label: "Hộp thư đa kênh", tab: "SALES CRM" as TabType, subTab: "OMNI-INBOX CHAT", keywords: "chat vip mailbox tro ly ai" },
  { label: "Ví & Nạp tiền", tab: "VÍ & NẠP TIỀN" as TabType, keywords: "vi nap tien so du vietqr nap bank" },
];

export default function Header({ currentTab, onSearchSelect, onMenuClick }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showUtilities, setShowUtilities] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramLink, setTelegramLink] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [notifs, setNotifs] = useState<WebNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      setIsDark(e.detail.theme === "dark");
    };
    window.addEventListener("theme-change" as any, handleThemeChange);
    return () => window.removeEventListener("theme-change" as any, handleThemeChange);
  }, []);

  const loadTelegramLinkStatus = async () => {
    if (!userProfile) return;
    try {
      const data = await authService.getTelegramLinkStatus();
      setTelegramLink(data);
    } catch (error) {
      console.error("Lỗi lấy trạng thái Telegram:", error);
    }
  };

  // ─── helpers & API calls ────────────────────────────────────
  const fetchNotifications = async () => {
    if (!userProfile) return;
    try {
      const res = await notificationService.getNotifications({ limit: 20 });
      setNotifs(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Lỗi khi tải thông báo từ API:", err);
    }
  };

  const formatNotifTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / (60 * 1000));
      if (diffMin < 1) return "Vừa xong";
      if (diffMin < 60) return `${diffMin} phút trước`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} giờ trước`;
      return d.toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return "Vừa xong";
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Lỗi khi đánh dấu đã đọc thông báo:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Lỗi khi đánh dấu đọc tất cả thông báo:", err);
    }
  };

  // Đồng bộ thông báo thời gian thực qua Socket.IO và sự kiện nội bộ
  useEffect(() => {
    if (!userProfile) return;

    fetchNotifications();

    // Lắng nghe thông báo mới từ socket
    const unsubSocket = socketService.on("new_notification", (notif: WebNotification) => {
      setNotifs((prev) => {
        // Tránh trùng lặp
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev];
      });
      if (!notif.read) {
        setUnreadCount((prev) => prev + 1);
      }
      // Kích hoạt CustomEvent để hiển thị popup nổi góc phải dưới
      window.dispatchEvent(new CustomEvent("new_notification_toast", { detail: notif }));
    });

    // Lắng nghe sự kiện đồng bộ từ các component khác
    const handleMutation = () => {
      fetchNotifications();
    };
    window.addEventListener("notification-mutation", handleMutation);

    return () => {
      unsubSocket();
      window.removeEventListener("notification-mutation", handleMutation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  // ─── Wallet balance ──────────────────────────────────────────
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await walletService.getWalletBalance();
        setBalance(bal);
      } catch (err) {
        console.error("Lỗi khi lấy số dư ví ở Header:", err);
      }
    };

    fetchBalance();

    // Polling số dư định kỳ mỗi 10 giây để đồng bộ tức thời
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadTelegramLinkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!showTelegramModal || !userProfile) {
      return;
    }

    loadTelegramLinkStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadTelegramLinkStatus();
      }
    };

    window.addEventListener("focus", loadTelegramLinkStatus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", loadTelegramLinkStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTelegramModal, userProfile?.uid]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResults =
    normalizedQuery === ""
      ? []
      : searchIndex
        .filter((item) => {
          if (isTabHidden(item.tab)) {
            return false;
          }
          return true;
        })
        .filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.keywords.toLowerCase().includes(normalizedQuery)
        );

  return (
    <header className="sticky top-0 z-40 flex h-18 items-center justify-between border-b border-gray-100 bg-white px-3 sm:px-6 shadow-xs" id="app_header">
      <div className="flex flex-1 items-center max-w-2xl">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="mr-3 md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:scale-95 cursor-pointer shrink-0"
            title="Mở menu"
            id="header_menu_btn"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="relative w-full" id="search_container">
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
      </div>

      <div className="ml-2 sm:ml-6 flex items-center gap-1 sm:gap-3" id="header_controls">

        {/* Wallet Balance Pill */}
        {userProfile && (
          <button
            onClick={() => onSearchSelect("VÍ & NẠP TIỀN" as TabType)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-blue-50 border border-blue-100 px-2.5 sm:px-4 py-2 font-sans transition-all hover:bg-blue-100/50 hover:border-blue-200 active:scale-95 shadow-xs shadow-blue-500/5 cursor-pointer"
            id="header_wallet_pill"
          >
            <Wallet className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="hidden sm:inline text-xs font-bold text-blue-700 font-mono select-none">
              {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(balance)} Credit
            </span>
          </button>
        )}

        {/* Pricing Info Button */}
        <button
          onClick={() => setShowPricingModal(true)}
          className="hidden sm:flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          title="Bảng giá dịch vụ"
          id="header_pricing_info_btn"
        >
          <Info className="h-4.5 w-4.5 shrink-0" />
        </button>

        {/* Dark Mode Toggle Button */}
        <button
          onClick={() => {
            const nextDark = !isDark;
            setIsDark(nextDark);
            if (nextDark) {
              document.documentElement.classList.add("dark");
              localStorage.setItem("theme", "dark");
              toast.success("Đã chuyển sang giao diện tối");
            } else {
              document.documentElement.classList.remove("dark");
              localStorage.setItem("theme", "light");
              toast.success("Đã chuyển sang giao diện sáng");
            }
            window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: nextDark ? "dark" : "light" } }));
          }}
          className="flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          title={isDark ? "Giao diện sáng" : "Giao diện tối"}
          id="header_darkmode_btn"
        >
          {isDark ? <Sun className="h-4.5 w-4.5 shrink-0 text-amber-500" /> : <Moon className="h-4.5 w-4.5 shrink-0" />}
        </button>

        {/* Utilities (App Launcher) Button */}
        <div className="relative" id="header_utilities_dropdown">
          <button
            onClick={() => setShowUtilities(!showUtilities)}
            className={`flex items-center justify-center p-2 rounded-full transition-all active:scale-95 cursor-pointer ${showUtilities ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
            title="Tiện ích — mở nhanh các chức năng"
            id="header_utilities_btn"
          >
            <LayoutGrid className="h-4.5 w-4.5 shrink-0" />
          </button>

          {showUtilities && (
            <div className={`absolute right-0 z-50 mt-3 w-[calc(100vw-1.5rem)] max-w-[580px] max-h-[80vh] overflow-y-auto rounded-3xl p-4 sm:p-6 shadow-2xl font-sans animate-fade-in border ${isDark ? "bg-[#18181b] text-neutral-100 border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : "bg-white text-slate-800 border-gray-150"}`}>
              {/* Header */}
              <div className={`flex items-center justify-between border-b pb-3.5 mb-2 ${isDark ? "border-neutral-800" : "border-gray-100"}`}>
                <span className={`text-base font-bold tracking-wide ${isDark ? "text-white" : "text-slate-800"}`}>Menu</span>
                <button
                  onClick={() => setShowUtilities(false)}
                  className={`p-1.5 rounded-full transition-all active:scale-90 ${isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800/50" : "text-gray-400 hover:text-slate-800 hover:bg-gray-100"}`}
                  aria-label="Đóng Menu"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Two Column Layout */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {/* Column Left (62%): Yêu thích & Tính năng */}
                <div className={`flex-[1.6] sm:pr-6 pb-4 sm:pb-0 border-b sm:border-b-0 sm:border-r ${isDark ? "border-neutral-800/85" : "border-gray-100"}`}>
                  {/* Group Yêu thích */}
                  <div>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>Yêu thích</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "SƠ ĐỒ TỔ CHỨC");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FolderTree className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Phòng ban</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quản lý các phòng ban</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "QUY TRÌNH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <GitBranch className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Quy trình công việc</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quy trình làm việc</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group Tính năng */}
                  <div className="mt-5">
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>Tính năng</h3>
                    <div className={`space-y-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent ${isDark ? "scrollbar-thumb-neutral-800" : "scrollbar-thumb-gray-200"}`}>
                      <div
                        onClick={() => {
                          onSearchSelect("TỔNG QUAN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <LayoutDashboard className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Tổng quan</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Xem tổng quát hoạt động</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Việc của tôi</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Các công việc của tôi</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <MessageSquare className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Nhắn tin & gọi điện</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Trò chuyện và gọi điện audio/video</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Video className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Cuộc họp trực tuyến</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Tạo cuộc họp trực tuyến giống như Zoom, Google Meet</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Calendar className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Lịch</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Lịch công việc và sự kiện</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("QUẢN LÝ TÀI NGUYÊN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FolderOpen className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Tài nguyên</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Các tài nguyên (files, docs, links...)</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Users className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Nhóm của tôi</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Các nhóm làm việc và trò chuyện</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Briefcase className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Lĩnh vực, dự án</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Lĩnh vực hoạt động và dự án</p>
                        </div>
                      </div>

                      {(userProfile?.role === "superadmin" || userProfile?.role === "admin") && (
                        <div
                          onClick={() => {
                            onSearchSelect("QUẢN TRỊ USER" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                            <Shield className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Thành viên</p>
                            <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quản lý thành viên & phân quyền</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Right (38%): Tạo & Cá nhân */}
                <div className="w-full sm:w-[190px] shrink-0">
                  {/* Group Tạo */}
                  <div>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>Tạo</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <FileText className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Công việc</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Users className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nhóm</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <MessageSquare className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nhắn tin</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÒ CHUYỆN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Video className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Cuộc gọi video</span>
                      </div>
                    </div>
                  </div>

                  {/* Group Cá nhân */}
                  <div className={`mt-5 border-t pt-4 ${isDark ? "border-neutral-800/80" : "border-gray-100"}`}>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>Cá nhân</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Calendar className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nghỉ phép</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Calendar className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Sự kiện</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Clock className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nhắc nhở</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showUtilities && <div className="fixed inset-0 z-[-1]" onClick={() => setShowUtilities(false)} />}
        </div>

        <div className="relative" id="notification_dropdown_button">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl p-2.5 text-gray-600 transition-all hover:bg-gray-50 active:scale-95"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 z-50 mt-3 w-[calc(100vw-1.5rem)] max-w-96 overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-2xl">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">Thông báo</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Xem tất cả
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-[420px] divide-y divide-gray-50 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Bell className="h-8 w-8 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">Không có thông báo</p>
                    <p className="text-xs text-gray-300">Mọi hoạt động sẽ xuất hiện tại đây</p>
                  </div>
                ) : (
                  notifs.map((notif) => {
                    const ICON_MAP: Record<string, { icon: React.ElementType; bg: string; iconColor: string; badge: string }> = {
                      kho: { icon: Package, bg: "bg-amber-50", iconColor: "text-amber-600", badge: "bg-amber-500" },
                      task: { icon: Briefcase, bg: "bg-blue-50", iconColor: "text-blue-600", badge: "bg-blue-500" },
                      training: { icon: GraduationCap, bg: "bg-purple-50", iconColor: "text-purple-600", badge: "bg-purple-500" },
                      "he-thong": { icon: Bell, bg: "bg-gray-100", iconColor: "text-gray-500", badge: "bg-gray-400" },
                    };
                    const cfg = ICON_MAP[notif.type] || ICON_MAP["he-thong"];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={notif._id}
                        onClick={() => {
                          markRead(notif._id);
                          if (notif.action) {
                            onSearchSelect(notif.action.tab as any, notif.action.subTab);
                            setShowNotifications(false);
                          }
                        }}
                        className={`flex cursor-pointer items-start gap-3 p-4 transition-all duration-300 hover:bg-gray-50/80 ${notif.read ? "opacity-40" : ""
                          }`}
                      >
                        {/* Icon badge */}
                        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                          <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                          {!notif.read && (
                            <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${cfg.badge} ring-2 ring-white`} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-snug ${notif.read ? "font-medium text-gray-500" : "font-bold text-gray-800"
                            }`}>{notif.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-400">{notif.body}</p>
                          <span className="mt-1 block font-mono text-[10px] text-gray-300">{formatNotifTime(notif.createdAt)}</span>
                        </div>

                        {/* Unread dot */}
                        {!notif.read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-2.5 text-center">
                <p className="text-[10px] font-medium text-gray-400">
                  {unreadCount === 0 ? "✔ Tất cả đã được đọc" : `${unreadCount} thông báo chưa đọc`}
                </p>
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
                    onClick={async () => {
                      setShowProfileMenu(false);
                      setShowTelegramModal(true);
                      await loadTelegramLinkStatus();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80"
                  >
                    <Send className="h-4 w-4 text-sky-500" />
                    <span className="flex-1">Telegram</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${telegramLink?.linked ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                      {telegramLink?.linked ? "Đã liên kết" : "Chưa"}
                    </span>
                  </button>
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

      {showPricingModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setShowPricingModal(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl transition-all border border-gray-100 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
            id="pricing_modal_content"
          >
            {/* Close button */}
            <button
              onClick={() => setShowPricingModal(false)}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              id="pricing_modal_close_btn"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-gray-950 flex items-center gap-2">
                Bảng giá dịch vụ
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Chi phí được tính dựa trên số lượng Credit tiêu thụ cho mỗi đơn vị sử dụng.
              </p>
            </div>

            {/* Exchange Rate Card */}
            <div className="bg-blue-50/50 border border-blue-100/60 rounded-2xl p-4 flex flex-col gap-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <span>💡</span> 100 VND = 1 Credit
              </div>
              <div className="text-xs text-blue-800 font-medium leading-relaxed">
                Chi phí được tính cố định cho mỗi lần phân tích prompt hoặc mỗi ảnh/video được tạo ra.
              </div>
            </div>

            {/* 1. Hình ảnh */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg">
                  <Image className="h-4 w-4" />
                </div>
                <span>Hình ảnh</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">Mô hình / Dịch vụ</th>
                      <th className="py-2 text-right font-semibold pr-8">Giá (Credit)</th>
                      <th className="py-2 text-right font-semibold">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 flash image preview</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">1K: 27.5| 2K: 42 (Tính theo Credit)</div>
                      </td>
                      <td className="py-3 text-right font-bold text-cyan-600 pr-8 text-sm">27,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ ảnh</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3 pro image preview</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">1K: 57 | 2K: 57 (Tính theo Credit)</div>
                      </td>
                      <td className="py-3 text-right font-bold text-cyan-600 pr-8 text-sm">57</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ ảnh</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Video */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Video className="h-4 w-4" />
                </div>
                <span>Video</span>
              </div>

              <div className="flex flex-col gap-6">
                {/* iGen Veo 3.1 Fast */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="font-bold text-gray-800 text-xs">iGen Veo 3.1 Fast</span>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        720p: 4s=162.0, 6s=243.0, 8s=324.0 | 1080p: 4s=194.4, 6s=291.6, 8s=388.8
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">/ video (8s)</span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50">
                    <table className="w-full text-center text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-gray-100/70 text-gray-500 font-semibold border-b border-gray-100">
                          <th className="py-1.5 text-left pl-3 font-semibold">Res</th>
                          <th className="py-1.5 font-semibold">4s</th>
                          <th className="py-1.5 font-semibold">6s</th>
                          <th className="py-1.5 font-semibold">8s</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        <tr className="hover:bg-gray-50/40">
                          <td className="py-1.5 text-left pl-3 font-semibold text-gray-600">720P</td>
                          <td className="py-1.5 font-bold text-blue-600">162</td>
                          <td className="py-1.5 font-bold text-blue-600">243</td>
                          <td className="py-1.5 font-bold text-blue-600">324</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40">
                          <td className="py-1.5 text-left pl-3 font-semibold text-gray-600">1080P</td>
                          <td className="py-1.5 font-bold text-blue-600">194,4</td>
                          <td className="py-1.5 font-bold text-blue-600">291,6</td>
                          <td className="py-1.5 font-bold text-blue-600">388,8</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* iGen Veo 3.1 Lite */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="font-bold text-gray-800 text-xs">iGen Veo 3.1 Lite</span>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        720p: 4s=81.0, 6s=121.5, 8s=162.0 | 1080p: 4s=129.6, 6s=194.4, 8s=259.2
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">/ video (8s)</span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50">
                    <table className="w-full text-center text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-gray-100/70 text-gray-500 font-semibold border-b border-gray-100">
                          <th className="py-1.5 text-left pl-3 font-semibold">Res</th>
                          <th className="py-1.5 font-semibold">4s</th>
                          <th className="py-1.5 font-semibold">6s</th>
                          <th className="py-1.5 font-semibold">8s</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        <tr className="hover:bg-gray-50/40">
                          <td className="py-1.5 text-left pl-3 font-semibold text-gray-600">720P</td>
                          <td className="py-1.5 font-bold text-blue-600">81</td>
                          <td className="py-1.5 font-bold text-blue-600">121,5</td>
                          <td className="py-1.5 font-bold text-blue-600">162</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40">
                          <td className="py-1.5 text-left pl-3 font-semibold text-gray-600">1080P</td>
                          <td className="py-1.5 font-bold text-blue-600">129,6</td>
                          <td className="py-1.5 font-bold text-blue-600">194,4</td>
                          <td className="py-1.5 font-bold text-blue-600">259,2</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Âm thanh */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Volume2 className="h-4 w-4" />
                </div>
                <span>Âm thanh</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">Mô hình / Dịch vụ</th>
                      <th className="py-2 text-right font-semibold pr-8">Giá (Credit)</th>
                      <th className="py-2 text-right font-semibold">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 2.5 Flash TTS</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Quy đổi từ $0.0005/giây gốc</div>
                      </td>
                      <td className="py-3 text-right font-bold text-purple-600 pr-8 text-sm">0,128</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ giây</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 2.5 Pro TTS</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Quy đổi từ $0.001/giây gốc</div>
                      </td>
                      <td className="py-3 text-right font-bold text-purple-600 pr-8 text-sm">0,255</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ giây</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Văn bản / Prompt */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileText className="h-4 w-4" />
                </div>
                <span>Văn bản / Prompt</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">Mô hình / Dịch vụ</th>
                      <th className="py-2 text-right font-semibold pr-8">Giá (Credit)</th>
                      <th className="py-2 text-right font-semibold">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 pro</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cố định mỗi lần tạo</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">10</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ lần</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 flash lite</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cố định mỗi lần tạo</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">1,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ lần</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3 flash</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cố định mỗi lần tạo</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">2,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ lần</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note Footer */}
            <div className="text-[10px] text-gray-400 font-medium italic mt-2 border-t border-gray-100 pt-3">
              * Bảng giá có thể thay đổi tùy theo chính sách của nhà cung cấp dịch vụ AI.
            </div>

          </div>
        </div>
      )}

      {showTelegramModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onClick={() => setShowTelegramModal(false)}>
          <div className="relative w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTelegramModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <div className="mb-2 inline-flex rounded-2xl bg-sky-50 p-2 text-sky-600">
                <Send className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Liên kết Telegram</h3>
              <p className="mt-1 text-xs text-gray-500">Chỉ dùng link liên kết từ web, không dùng đăng nhập Telegram nữa.</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-600">Trạng thái</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${telegramLink?.linked ? "bg-emerald-100 text-emerald-700" : "border border-gray-200 bg-white text-gray-500"}`}>
                  {telegramLink?.linked ? "Đã liên kết" : "Chưa liên kết"}
                </span>
              </div>
              {telegramLink?.linked && (
                <p className="mt-2 text-[11px] text-gray-500">Telegram đã được liên kết với tài khoản này.</p>
              )}
              {!telegramLink?.linked && telegramLink?.pendingCode && (
                <p className="mt-2 text-[11px] text-gray-500">Web sẽ tự cập nhật ngay sau khi bạn liên kết xong trên Telegram.</p>
              )}
            </div>

            {!telegramLink?.linked && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-[11px] font-semibold text-sky-700">1. Mở bot</p>
                <a
                  href={`https://t.me/${telegramLink?.botUsername || "iGEN_ERP_Bot"}?start=${encodeURIComponent(telegramLink?.pendingCode || "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-bold text-sky-800 underline decoration-sky-300 underline-offset-4"
                >
                  Mở @{telegramLink?.botUsername || "iGEN_ERP_Bot"}
                </a>
                <p className="mt-3 text-[11px] font-semibold text-sky-700">2. Mã dự phòng</p>
                <div className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold text-gray-900">
                  /link {telegramLink?.pendingCode || "......"}
                </div>
                <p className="mt-2 text-[11px] text-gray-500">Thông thường chỉ cần bấm link mở bot ở trên. Lệnh này chỉ là phương án dự phòng.</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {!telegramLink?.linked && (
                <button
                  onClick={async () => {
                    try {
                      setTelegramLoading(true);
                      const data = await authService.createTelegramLinkCode();
                      setTelegramLink(data);
                      toast.success("Đã tạo mã liên kết Telegram.");
                    } catch (error: any) {
                      toast.error(error.message || "Không thể tạo mã liên kết Telegram.");
                    } finally {
                      setTelegramLoading(false);
                    }
                  }}
                  className="flex-1 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={telegramLoading}
                >
                  {telegramLoading ? "Đang tạo..." : telegramLink?.pendingCode ? "Tạo lại mã" : "Tạo mã"}
                </button>
              )}

              {telegramLink?.linked && (
                <button
                  onClick={async () => {
                    try {
                      setTelegramLoading(true);
                      const data = await authService.unlinkTelegram();
                      setTelegramLink(data);
                      toast.success("Đã gỡ liên kết Telegram và tạo sẵn mã liên kết mới.");
                    } catch (error: any) {
                      toast.error(error.message || "Không thể gỡ liên kết Telegram.");
                    } finally {
                      setTelegramLoading(false);
                    }
                  }}
                  className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={telegramLoading}
                >
                  {telegramLoading ? "Đang xử lý..." : "Gỡ liên kết"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
