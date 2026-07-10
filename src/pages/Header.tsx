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
  { label: "Tá»•ng quan Doanh nghiá»‡p", tab: "Tá»”NG QUAN" as TabType, keywords: "tong quan dashboard kpi hieu suat bieu do" },
  { label: "SÆ¡ Ä‘á»“ tá»• chá»©c", tab: "NHÃ‚N Sá»°" as TabType, subTab: "SÆ  Äá»’ Tá»” CHá»¨C", keywords: "hr so do to chuc nhan su phong ban" },
  { label: "Giao viá»‡c Kanban", tab: "NHÃ‚N Sá»°" as TabType, subTab: "GIAO VIá»†C KANBAN", keywords: "hr giao viec kanban task list cong viec" },
  { label: "ÄÃ o táº¡o e-Learning", tab: "NHÃ‚N Sá»°" as TabType, subTab: "ÄÃ€O Táº O", keywords: "onboarding hoc tap dao tao kien thuc video" },
  { label: "Danh má»¥c Kho & Sáº£n pháº©m", tab: "KHO & Sáº¢N PHáº¨M" as TabType, subTab: "DANH Má»¤C", keywords: "kho hang san pham price danh muc gia ban" },
  { label: "Nháº­p / Xuáº¥t kho hÃ ng", tab: "KHO & Sáº¢N PHáº¨M" as TabType, subTab: "NHáº¬P / XUáº¤T KHO", keywords: "nhap kho xuat kho phieu nhap phieu xuat chung tu" },
  { label: "Dá»± bÃ¡o AI & cáº£nh bÃ¡o tá»“n kho", tab: "KHO & Sáº¢N PHáº¨M" as TabType, subTab: "Dá»° BÃO AI", keywords: "ai forecast du bao nhu cau canh bao" },
  { label: "VÃ­ & Náº¡p tiá»n", tab: "VÃ & Náº P TIá»€N" as TabType, keywords: "vi nap tien so du payos vietqr nap bank" },
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
      console.error("Lá»—i láº¥y tráº¡ng thÃ¡i Telegram:", error);
    }
  };

  // â”€â”€â”€ helpers & API calls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchNotifications = async () => {
    if (!userProfile) return;
    try {
      const res = await notificationService.getNotifications({ limit: 20 });
      setNotifs(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Lá»—i khi táº£i thÃ´ng bÃ¡o tá»« API:", err);
    }
  };

  const formatNotifTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / (60 * 1000));
      if (diffMin < 1) return "Vá»«a xong";
      if (diffMin < 60) return `${diffMin} phÃºt trÆ°á»›c`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} giá» trÆ°á»›c`;
      return d.toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return "Vá»«a xong";
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Lá»—i khi Ä‘Ã¡nh dáº¥u Ä‘Ã£ Ä‘á»c thÃ´ng bÃ¡o:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Lá»—i khi Ä‘Ã¡nh dáº¥u Ä‘á»c táº¥t cáº£ thÃ´ng bÃ¡o:", err);
    }
  };

  // Äá»“ng bá»™ thÃ´ng bÃ¡o thá»i gian thá»±c qua Socket.IO vÃ  sá»± kiá»‡n ná»™i bá»™
  useEffect(() => {
    if (!userProfile) return;

    fetchNotifications();

    // Láº¯ng nghe thÃ´ng bÃ¡o má»›i tá»« socket
    const unsubSocket = socketService.on("new_notification", (notif: WebNotification) => {
      setNotifs((prev) => {
        // TrÃ¡nh trÃ¹ng láº·p
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev];
      });
      if (!notif.read) {
        setUnreadCount((prev) => prev + 1);
      }
      // KÃ­ch hoáº¡t CustomEvent Ä‘á»ƒ hiá»ƒn thá»‹ popup ná»•i gÃ³c pháº£i dÆ°á»›i
      window.dispatchEvent(new CustomEvent("new_notification_toast", { detail: notif }));
    });

    // Láº¯ng nghe sá»± kiá»‡n Ä‘á»“ng bá»™ tá»« cÃ¡c component khÃ¡c
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

  // â”€â”€â”€ Wallet balance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const bal = await walletService.getWalletBalance();
        setBalance(bal);
      } catch (err) {
        console.error("Lá»—i khi láº¥y sá»‘ dÆ° vÃ­ á»Ÿ Header:", err);
      }
    };

    fetchBalance();

    // Polling sá»‘ dÆ° Ä‘á»‹nh ká»³ má»—i 10 giÃ¢y Ä‘á»ƒ Ä‘á»“ng bá»™ tá»©c thá»i
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
        })
        .filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.keywords.toLowerCase().includes(normalizedQuery)
        );

  return (
    <header className="sticky top-0 z-40 flex h-18 items-center justify-between border-b border-gray-100 bg-white px-6 shadow-xs" id="app_header">
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

      <div className="ml-6 flex items-center gap-3" id="header_controls">

        {/* Wallet Balance Pill */}
        {userProfile && (
          <button
            onClick={() => onSearchSelect("VÃ & Náº P TIá»€N" as TabType)}
            className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2 font-sans transition-all hover:bg-blue-100/50 hover:border-blue-200 active:scale-95 shadow-xs shadow-blue-500/5 cursor-pointer"
            id="header_wallet_pill"
          >
            <Wallet className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-700 font-mono select-none">
              {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(balance)} Credit
            </span>
          </button>
        )}

        {/* Pricing Info Button */}
        <button
          onClick={() => setShowPricingModal(true)}
          className="flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          title="Báº£ng giÃ¡ dá»‹ch vá»¥"
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
              toast.success("ÄÃ£ chuyá»ƒn sang giao diá»‡n tá»‘i");
            } else {
              document.documentElement.classList.remove("dark");
              localStorage.setItem("theme", "light");
              toast.success("ÄÃ£ chuyá»ƒn sang giao diá»‡n sÃ¡ng");
            }
            window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme: nextDark ? "dark" : "light" } }));
          }}
          className="flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          title={isDark ? "Giao diá»‡n sÃ¡ng" : "Giao diá»‡n tá»‘i"}
          id="header_darkmode_btn"
        >
          {isDark ? <Sun className="h-4.5 w-4.5 shrink-0 text-amber-500" /> : <Moon className="h-4.5 w-4.5 shrink-0" />}
        </button>

        {/* Utilities (App Launcher) Button */}
        <div className="relative" id="header_utilities_dropdown">
          <button
            onClick={() => setShowUtilities(!showUtilities)}
            className={`flex items-center justify-center p-2 rounded-full transition-all active:scale-95 cursor-pointer ${showUtilities ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
            title="Tiá»‡n Ã­ch â€” má»Ÿ nhanh cÃ¡c chá»©c nÄƒng"
            id="header_utilities_btn"
          >
            <LayoutGrid className="h-4.5 w-4.5 shrink-0" />
          </button>

          {showUtilities && (
            <div className={`absolute right-0 z-50 mt-3 w-[580px] rounded-3xl p-6 shadow-2xl font-sans animate-fade-in border ${isDark ? "bg-[#18181b] text-neutral-100 border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : "bg-white text-slate-800 border-gray-150"}`}>
              {/* Header */}
              <div className={`flex items-center justify-between border-b pb-3.5 mb-2 ${isDark ? "border-neutral-800" : "border-gray-100"}`}>
                <span className={`text-base font-bold tracking-wide ${isDark ? "text-white" : "text-slate-800"}`}>Menu</span>
                <button
                  onClick={() => setShowUtilities(false)}
                  className={`p-1.5 rounded-full transition-all active:scale-90 ${isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800/50" : "text-gray-400 hover:text-slate-800 hover:bg-gray-100"}`}
                  aria-label="ÄÃ³ng Menu"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Two Column Layout */}
              <div className="flex gap-6">
                {/* Column Left (62%): YÃªu thÃ­ch & TÃ­nh nÄƒng */}
                <div className={`flex-[1.6] pr-6 border-r ${isDark ? "border-neutral-800/85" : "border-gray-100"}`}>
                  {/* Group YÃªu thÃ­ch */}
                  <div>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>YÃªu thÃ­ch</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "SÆ  Äá»’ Tá»” CHá»¨C");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FolderTree className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>PhÃ²ng ban</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quáº£n lÃ½ cÃ¡c phÃ²ng ban</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "QUY TRÃŒNH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <GitBranch className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Quy trÃ¬nh cÃ´ng viá»‡c</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quy trÃ¬nh lÃ m viá»‡c</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group TÃ­nh nÄƒng */}
                  <div className="mt-5">
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>TÃ­nh nÄƒng</h3>
                    <div className={`space-y-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent ${isDark ? "scrollbar-thumb-neutral-800" : "scrollbar-thumb-gray-200"}`}>
                      <div
                        onClick={() => {
                          onSearchSelect("Tá»”NG QUAN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <LayoutDashboard className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Tá»•ng quan</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Xem tá»•ng quÃ¡t hoáº¡t Ä‘á»™ng</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "GIAO VIá»†C KANBAN");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Viá»‡c cá»§a tÃ´i</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>CÃ¡c cÃ´ng viá»‡c cá»§a tÃ´i</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <MessageSquare className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Nháº¯n tin & gá»i Ä‘iá»‡n</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>TrÃ² chuyá»‡n vÃ  gá»i Ä‘iá»‡n audio/video</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Video className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Cuá»™c há»p trá»±c tuyáº¿n</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Táº¡o cuá»™c há»p trá»±c tuyáº¿n giá»‘ng nhÆ° Zoom, Google Meet</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "Lá»ŠCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Calendar className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>Lá»‹ch</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Lá»‹ch cÃ´ng viá»‡c vÃ  sá»± kiá»‡n</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("QUáº¢N LÃ TÃ€I NGUYÃŠN" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <FolderOpen className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>TÃ i nguyÃªn</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>CÃ¡c tÃ i nguyÃªn (files, docs, links...)</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Users className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>NhÃ³m cá»§a tÃ´i</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>CÃ¡c nhÃ³m lÃ m viá»‡c vÃ  trÃ² chuyá»‡n</p>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "GIAO VIá»†C KANBAN");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                          <Briefcase className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>LÄ©nh vá»±c, dá»± Ã¡n</p>
                          <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>LÄ©nh vá»±c hoáº¡t Ä‘á»™ng vÃ  dá»± Ã¡n</p>
                        </div>
                      </div>

                      {(userProfile?.role === "superadmin" || userProfile?.role === "admin") && (
                        <div
                          onClick={() => {
                            onSearchSelect("QUáº¢N TRá»Š USER" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}>
                            <Shield className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>ThÃ nh viÃªn</p>
                            <p className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}>Quáº£n lÃ½ thÃ nh viÃªn & phÃ¢n quyá»n</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Right (38%): Táº¡o & CÃ¡ nhÃ¢n */}
                <div className="w-[190px] shrink-0">
                  {/* Group Táº¡o */}
                  <div>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>Táº¡o</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "GIAO VIá»†C KANBAN");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <FileText className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>CÃ´ng viá»‡c</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Users className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>NhÃ³m</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <MessageSquare className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nháº¯n tin</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("TRÃ’ CHUYá»†N" as TabType);
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Video className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Cuá»™c gá»i video</span>
                      </div>
                    </div>
                  </div>

                  {/* Group CÃ¡ nhÃ¢n */}
                  <div className={`mt-5 border-t pt-4 ${isDark ? "border-neutral-800/80" : "border-gray-100"}`}>
                    <h3 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}>CÃ¡ nhÃ¢n</h3>
                    <div className="space-y-1">
                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "Lá»ŠCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Calendar className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nghá»‰ phÃ©p</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "Lá»ŠCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Calendar className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Sá»± kiá»‡n</span>
                      </div>

                      <div
                        onClick={() => {
                          onSearchSelect("NHÃ‚N Sá»°" as TabType, "Lá»ŠCH");
                          setShowUtilities(false);
                        }}
                        className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                      >
                        <Clock className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`} />
                        <span className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}>Nháº¯c nhá»Ÿ</span>
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
            <div className="absolute right-0 z-50 mt-3 w-96 overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-2xl">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">ThÃ´ng bÃ¡o</span>
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
                  Xem táº¥t cáº£
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-[420px] divide-y divide-gray-50 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Bell className="h-8 w-8 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">KhÃ´ng cÃ³ thÃ´ng bÃ¡o</p>
                    <p className="text-xs text-gray-300">Má»i hoáº¡t Ä‘á»™ng sáº½ xuáº¥t hiá»‡n táº¡i Ä‘Ã¢y</p>
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
                  {unreadCount === 0 ? "âœ” Táº¥t cáº£ Ä‘Ã£ Ä‘Æ°á»£c Ä‘á»c" : `${unreadCount} thÃ´ng bÃ¡o chÆ°a Ä‘á»c`}
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">TÃ i khoáº£n</p>
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
                      {telegramLink?.linked ? "ÄÃ£ liÃªn káº¿t" : "ChÆ°a"}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      onSearchSelect("CÃ€I Äáº¶T" as TabType);
                      setShowProfileMenu(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span>CÃ i Ä‘áº·t cÃ¡ nhÃ¢n</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowProfileMenu(false);
                      await logout();
                    }}
                    className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-t border-gray-50 px-3 py-2 pt-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50/80"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>ÄÄƒng xuáº¥t há»‡ thá»‘ng</span>
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
                Báº£ng giÃ¡ dá»‹ch vá»¥
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Chi phÃ­ Ä‘Æ°á»£c tÃ­nh dá»±a trÃªn sá»‘ lÆ°á»£ng Credit tiÃªu thá»¥ cho má»—i Ä‘Æ¡n vá»‹ sá»­ dá»¥ng.
              </p>
            </div>

            {/* Exchange Rate Card */}
            <div className="bg-blue-50/50 border border-blue-100/60 rounded-2xl p-4 flex flex-col gap-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <span>ðŸ’¡</span> 100 VND = 1 Credit
              </div>
              <div className="text-xs text-blue-800 font-medium leading-relaxed">
                Chi phÃ­ Ä‘Æ°á»£c tÃ­nh cá»‘ Ä‘á»‹nh cho má»—i láº§n phÃ¢n tÃ­ch prompt hoáº·c má»—i áº£nh/video Ä‘Æ°á»£c táº¡o ra.
              </div>
            </div>

            {/* 1. HÃ¬nh áº£nh */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-lg">
                  <Image className="h-4 w-4" />
                </div>
                <span>HÃ¬nh áº£nh</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">MÃ´ hÃ¬nh / Dá»‹ch vá»¥</th>
                      <th className="py-2 text-right font-semibold pr-8">GiÃ¡ (Credit)</th>
                      <th className="py-2 text-right font-semibold">ÄÆ¡n vá»‹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 flash image preview</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">1K: 27.5| 2K: 42 (TÃ­nh theo Credit)</div>
                      </td>
                      <td className="py-3 text-right font-bold text-cyan-600 pr-8 text-sm">27,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ áº£nh</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3 pro image preview</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">1K: 57 | 2K: 57 (TÃ­nh theo Credit)</div>
                      </td>
                      <td className="py-3 text-right font-bold text-cyan-600 pr-8 text-sm">57</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ áº£nh</td>
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

            {/* 3. Ã‚m thanh */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Volume2 className="h-4 w-4" />
                </div>
                <span>Ã‚m thanh</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">MÃ´ hÃ¬nh / Dá»‹ch vá»¥</th>
                      <th className="py-2 text-right font-semibold pr-8">GiÃ¡ (Credit)</th>
                      <th className="py-2 text-right font-semibold">ÄÆ¡n vá»‹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 2.5 Flash TTS</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Quy Ä‘á»•i tá»« $0.0005/giÃ¢y gá»‘c</div>
                      </td>
                      <td className="py-3 text-right font-bold text-purple-600 pr-8 text-sm">0,128</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ giÃ¢y</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 2.5 Pro TTS</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Quy Ä‘á»•i tá»« $0.001/giÃ¢y gá»‘c</div>
                      </td>
                      <td className="py-3 text-right font-bold text-purple-600 pr-8 text-sm">0,255</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ giÃ¢y</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. VÄƒn báº£n / Prompt */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileText className="h-4 w-4" />
                </div>
                <span>VÄƒn báº£n / Prompt</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-400 font-medium border-b border-gray-100">
                      <th className="py-2 font-semibold">MÃ´ hÃ¬nh / Dá»‹ch vá»¥</th>
                      <th className="py-2 text-right font-semibold pr-8">GiÃ¡ (Credit)</th>
                      <th className="py-2 text-right font-semibold">ÄÆ¡n vá»‹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 pro</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cá»‘ Ä‘á»‹nh má»—i láº§n táº¡o</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">10</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ láº§n</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3.1 flash lite</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cá»‘ Ä‘á»‹nh má»—i láº§n táº¡o</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">1,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ láº§n</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen 3 flash</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">Cá»‘ Ä‘á»‹nh má»—i láº§n táº¡o</div>
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600 pr-8 text-sm">2,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ láº§n</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note Footer */}
            <div className="text-[10px] text-gray-400 font-medium italic mt-2 border-t border-gray-100 pt-3">
              * Báº£ng giÃ¡ cÃ³ thá»ƒ thay Ä‘á»•i tÃ¹y theo chÃ­nh sÃ¡ch cá»§a nhÃ  cung cáº¥p dá»‹ch vá»¥ AI.
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
              <h3 className="text-base font-bold text-gray-900">LiÃªn káº¿t Telegram</h3>
              <p className="mt-1 text-xs text-gray-500">Chá»‰ dÃ¹ng link liÃªn káº¿t tá»« web, khÃ´ng dÃ¹ng Ä‘Äƒng nháº­p Telegram ná»¯a.</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-600">Tráº¡ng thÃ¡i</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${telegramLink?.linked ? "bg-emerald-100 text-emerald-700" : "border border-gray-200 bg-white text-gray-500"}`}>
                  {telegramLink?.linked ? "ÄÃ£ liÃªn káº¿t" : "ChÆ°a liÃªn káº¿t"}
                </span>
              </div>
              {telegramLink?.linked && (
                <p className="mt-2 text-[11px] text-gray-500">Telegram Ä‘Ã£ Ä‘Æ°á»£c liÃªn káº¿t vá»›i tÃ i khoáº£n nÃ y.</p>
              )}
              {!telegramLink?.linked && telegramLink?.pendingCode && (
                <p className="mt-2 text-[11px] text-gray-500">Web sáº½ tá»± cáº­p nháº­t ngay sau khi báº¡n liÃªn káº¿t xong trÃªn Telegram.</p>
              )}
            </div>

            {!telegramLink?.linked && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-[11px] font-semibold text-sky-700">1. Má»Ÿ bot</p>
                <a
                  href={`https://t.me/${telegramLink?.botUsername || "iGEN_ERP_Bot"}?start=${encodeURIComponent(telegramLink?.pendingCode || "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-bold text-sky-800 underline decoration-sky-300 underline-offset-4"
                >
                  Má»Ÿ @{telegramLink?.botUsername || "iGEN_ERP_Bot"}
                </a>
                <p className="mt-3 text-[11px] font-semibold text-sky-700">2. MÃ£ dá»± phÃ²ng</p>
                <div className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold text-gray-900">
                  /link {telegramLink?.pendingCode || "......"}
                </div>
                <p className="mt-2 text-[11px] text-gray-500">ThÃ´ng thÆ°á»ng chá»‰ cáº§n báº¥m link má»Ÿ bot á»Ÿ trÃªn. Lá»‡nh nÃ y chá»‰ lÃ  phÆ°Æ¡ng Ã¡n dá»± phÃ²ng.</p>
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
                      toast.success("ÄÃ£ táº¡o mÃ£ liÃªn káº¿t Telegram.");
                    } catch (error: any) {
                      toast.error(error.message || "KhÃ´ng thá»ƒ táº¡o mÃ£ liÃªn káº¿t Telegram.");
                    } finally {
                      setTelegramLoading(false);
                    }
                  }}
                  className="flex-1 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={telegramLoading}
                >
                  {telegramLoading ? "Äang táº¡o..." : telegramLink?.pendingCode ? "Táº¡o láº¡i mÃ£" : "Táº¡o mÃ£"}
                </button>
              )}

              {telegramLink?.linked && (
                <button
                  onClick={async () => {
                    try {
                      setTelegramLoading(true);
                      const data = await authService.unlinkTelegram();
                      setTelegramLink(data);
                      toast.success("ÄÃ£ gá»¡ liÃªn káº¿t Telegram vÃ  táº¡o sáºµn mÃ£ liÃªn káº¿t má»›i.");
                    } catch (error: any) {
                      toast.error(error.message || "KhÃ´ng thá»ƒ gá»¡ liÃªn káº¿t Telegram.");
                    } finally {
                      setTelegramLoading(false);
                    }
                  }}
                  className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={telegramLoading}
                >
                  {telegramLoading ? "Äang xá»­ lÃ½..." : "Gá»¡ liÃªn káº¿t"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
