import React, { useState, useEffect } from "react";
import { Bell, LogOut, Search, Settings, Wallet, Info, X, Image, Video, Volume2, FileText,
  Package, Megaphone, Sparkles, CheckCheck, ShoppingCart, AlertTriangle } from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { walletService } from "../services/walletService";
import { marketingService } from "../services/marketingService";
import { inventoryProductService } from "../services/inventoryProductService";
import { crmService } from "../services/crmService";

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
  { label: "Ví & Nạp tiền", tab: "VÍ & NẠP TIỀN" as TabType, keywords: "vi nap tien so du payos vietqr nap bank" },
];

type NotifType = "crm" | "kho" | "marketing" | "ai" | "he-thong";
interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  action?: { tab: TabType; subTab?: string };
}

export default function Header({ currentTab, onSearchSelect }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);

  // ─── helpers ────────────────────────────────────────────────
  const unreadCount = notifs.filter(n => !n.read).length;

  const getReadSignatures = (): string[] => {
    try {
      const saved = localStorage.getItem("igen_read_notifications_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveReadSignatures = (sigs: string[]) => {
    try {
      localStorage.setItem("igen_read_notifications_v1", JSON.stringify(sigs));
    } catch (err) {
      console.error("Lỗi khi lưu trạng thái thông báo:", err);
    }
  };

  const getNotifSignature = (n: AppNotification) => `${n.id}:${n.title}:${n.body}`;

  const markRead = (id: string) => {
    setNotifs(prev => {
      const target = prev.find(n => n.id === id);
      if (target) {
        const signature = getNotifSignature(target);
        const signatures = getReadSignatures();
        if (!signatures.includes(signature)) {
          saveReadSignatures([...signatures, signature]);
        }
      }
      return prev.map(n => n.id === id ? { ...n, read: true } : n);
    });
  };

  const markAllRead = () => {
    setNotifs(prev => {
      const newSigs = prev.map(n => getNotifSignature(n));
      const signatures = getReadSignatures();
      const unique = Array.from(new Set([...signatures, ...newSigs]));
      saveReadSignatures(unique);
      return prev.map(n => ({ ...n, read: true }));
    });
  };

  const upsertNotif = (notif: AppNotification) =>
    setNotifs(prev => {
      const idx = prev.findIndex(n => n.id === notif.id);
      
      const signatures = getReadSignatures();
      const newSignature = getNotifSignature(notif);
      const isReadInStorage = signatures.includes(newSignature);
      
      let finalRead = isReadInStorage;

      if (idx === -1) {
        return [{ ...notif, read: finalRead }, ...prev];
      }

      const old = prev[idx];
      const oldSignature = getNotifSignature(old);

      if (oldSignature !== newSignature) {
        // Content changed, so it becomes unread unless it's in storage
        finalRead = isReadInStorage;
      } else {
        // Content didn't change, preserve state
        finalRead = isReadInStorage || old.read;
      }

      return [
        ...prev.slice(0, idx),
        { ...notif, read: finalRead },
        ...prev.slice(idx + 1),
      ];
    });

  // ─── CRM leads (new / pending orders) ───────────────────────
  useEffect(() => {
    const unsub = crmService.subscribeLeads((leads) => {
      const hotLeads = leads.filter((l: any) => l.stage === "hot" || l.stage === "deal");
      const newLeads = leads.filter((l: any) => l.stage === "cold" || l.stage === "warm");
      if (hotLeads.length > 0) {
        upsertNotif({
          id: "crm-hot",
          type: "crm",
          title: `${hotLeads.length} đơn hàng cần chốt`,
          body: `${hotLeads.length} khách hàng tiềm năng đang ở giai đoạn HOT / DEAL — cần xử lý ngay.`,
          time: "Vừa cập nhật",
          read: false,
          action: { tab: "SALES CRM" as TabType, subTab: "PHỄU KHÁCH HÀNG" },
        });
      }
      if (newLeads.length > 0) {
        upsertNotif({
          id: "crm-new",
          type: "crm",
          title: `${newLeads.length} lead mới chưa xử lý`,
          body: `Có ${newLeads.length} khách hàng mới (cold/warm) đang chờ tiếp cận và nuôi dưỡng.`,
          time: "Vừa cập nhật",
          read: false,
          action: { tab: "SALES CRM" as TabType, subTab: "PHỄU KHÁCH HÀNG" },
        });
      }
    }, () => {});
    return () => { if (typeof unsub === "function") unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Inventory (low stock) ───────────────────────────────────
  useEffect(() => {
    const unsub = inventoryProductService.subscribe((products: any[]) => {
      const low = products.filter(p =>
        typeof p.stock === "number" && typeof p.minStockAlert === "number" && p.stock <= p.minStockAlert
      );
      if (low.length === 0) return;
      upsertNotif({
        id: "kho-low",
        type: "kho",
        title: `${low.length} sản phẩm sắp hết hàng`,
        body: `"${low[0].name}" (tồn: ${low[0].stock}) đang dưới ngưỡng cảnh báo. Cần nhập hàng sớm.`,
        time: "Vừa cập nhật",
        read: false,
        action: { tab: "KHO & SẢN PHẨM" as TabType, subTab: "DỰ BÁO AI" },
      });
    });
    return () => { if (typeof unsub === "function") unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Marketing pending ───────────────────────────────────────
  useEffect(() => {
    const unsub = marketingService.subscribeToContents(
      (cards) => {
        const pending = cards.filter((c: any) => c.status === "pending");
        if (pending.length === 0) return;
        upsertNotif({
          id: "mkt-pending",
          type: "marketing",
          title: `${pending.length} bài viết chờ duyệt`,
          body: `AI đã tạo ${pending.length} nội dung Marketing cần được phê duyệt trước khi đăng.`,
          time: "Vừa cập nhật",
          read: false,
          action: { tab: "MARKETING" as TabType, subTab: "DUYỆT NỘI DUNG" },
        });
      },
      () => {},
      userProfile?.uid,
      userProfile?.role,
    );
    return () => { if (typeof unsub === "function") unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid, userProfile?.role]);

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

        {/* Wallet Balance Pill */}
        <button
          onClick={() => onSearchSelect("VÍ & NẠP TIỀN" as TabType)}
          className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2 font-sans transition-all hover:bg-blue-100/50 hover:border-blue-200 active:scale-95 shadow-xs shadow-blue-500/5 cursor-pointer"
          id="header_wallet_pill"
        >
          <Wallet className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-blue-700 font-mono select-none">
            {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(balance)} Credit
          </span>
        </button>

        {/* Pricing Info Button */}
        <button
          onClick={() => setShowPricingModal(true)}
          className="flex items-center justify-center p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          title="Bảng giá dịch vụ"
          id="header_pricing_info_btn"
        >
          <Info className="h-4.5 w-4.5 shrink-0" />
        </button>

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
                    const ICON_MAP: Record<NotifType, { icon: React.ElementType; bg: string; iconColor: string; badge: string }> = {
                      crm:       { icon: ShoppingCart, bg: "bg-emerald-50",  iconColor: "text-emerald-600", badge: "bg-emerald-500" },
                      kho:       { icon: AlertTriangle, bg: "bg-amber-50",    iconColor: "text-amber-600",   badge: "bg-amber-500" },
                      marketing: { icon: Megaphone,     bg: "bg-purple-50",   iconColor: "text-purple-600",  badge: "bg-purple-500" },
                      ai:        { icon: Sparkles,      bg: "bg-blue-50",     iconColor: "text-blue-600",    badge: "bg-blue-500" },
                      "he-thong":{ icon: Bell,          bg: "bg-gray-100",    iconColor: "text-gray-500",    badge: "bg-gray-400" },
                    };
                    const cfg = ICON_MAP[notif.type];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markRead(notif.id);
                          if (notif.action) {
                            onSearchSelect(notif.action.tab, notif.action.subTab);
                            setShowNotifications(false);
                          }
                        }}
                        className={`flex cursor-pointer items-start gap-3 p-4 transition-all duration-300 hover:bg-gray-50/80 ${
                          notif.read ? "opacity-40" : ""
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
                          <p className={`text-xs leading-snug ${
                            notif.read ? "font-medium text-gray-500" : "font-bold text-gray-800"
                          }`}>{notif.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-gray-400">{notif.body}</p>
                          <span className="mt-1 block font-mono text-[10px] text-gray-300">{notif.time}</span>
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
                        <div className="font-bold text-gray-800">iGen-3.1-flash-image-preview</div>
                        <div className="text-[10px] text-gray-400 font-medium mt-0.5">1K: 27.5| 2K: 42 (Tính theo Credit)</div>
                      </td>
                      <td className="py-3 text-right font-bold text-cyan-600 pr-8 text-sm">27,5</td>
                      <td className="py-3 text-right text-gray-400 font-medium">/ ảnh</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-bold text-gray-800">iGen-3-pro-image-preview</div>
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
    </header>
  );
}
