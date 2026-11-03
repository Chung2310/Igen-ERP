/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, LogOut, Search, Settings, X, Package, CheckCheck, Send, Sun, Moon,
  Briefcase, GraduationCap, Clock, LogIn, LogOut as LogOutIcon,
} from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { authService } from "../services/authService";
import { isTabHidden } from "../config/modules";
import { HEADER_MODULE_LABELS } from "../config/header-module-label";
import { toast } from "./Toast";
import { notificationService, WebNotification } from "../services/notificationService";
import { socketService } from "../services/socketService";
import AttendanceCameraModal from "../components/attendance/AttendanceCameraModal";
import { ATTENDANCE_FACE_CHECK_ENABLED } from "../config/attendanceFaceCheck";
import BranchSwitcher from "../components/BranchSwitcher";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ModuleLauncherLogo } from "../components/common/ModuleLauncherLogo";
import { ModuleQuickMenu } from "../components/common/ModuleQuickMenu";

interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
  variant?: "default" | "launcher";
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
];

export default function Header({ currentTab, onSearchSelect, variant = "default" }: HeaderProps) {
  const isLauncher = variant === "launcher";
  const { userProfile, logout } = useAuth();
  const { branches, activeBranchId, setActiveBranchId } = useBranch();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const moduleButtonRef = useRef<HTMLButtonElement>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramLink, setTelegramLink] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [notifs, setNotifs] = useState<WebNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
  });
  const closeLogoutConfirm = useCallback(() => {
    setShowLogoutConfirm(false);
    requestAnimationFrame(() => profileButtonRef.current?.focus());
  }, []);
  const confirmLogout = async () => {
    setLogoutSubmitting(true);
    try {
      await logout();
      setShowLogoutConfirm(false);
    } catch {
      toast.error("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setLogoutSubmitting(false);
    }
  };

  // ─── Attendance (Chấm công) ──────────────────────────────────
  const [todayTimekeeping, setTodayTimekeeping] = useState<any>(null);
  const [timekeepingChecking, setTimekeepingChecking] = useState<"in" | "out" | null>(null);
  const [timekeepingCameraAction, setTimekeepingCameraAction] = useState<"in" | "out" | null>(null);
  const timekeepingCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const fetchHeaderTimekeeping = async () => {
    try {
      const token = localStorage.getItem("accessToken") || "";
      if (!token) return;
      const res = await fetch("/api/v1/timekeeping/today", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setTodayTimekeeping(result.data?.log ?? null);
      }
    } catch {
      // silent fail — Header không chặn UI nếu API lỗi
    }
  };

  useEffect(() => {
    if (!userProfile) return;
    fetchHeaderTimekeeping();
    const intervalId = setInterval(fetchHeaderTimekeeping, 30000);
    const handleMutation = () => fetchHeaderTimekeeping();
    window.addEventListener("timekeeping-mutation", handleMutation);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("timekeeping-mutation", handleMutation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const handleTimekeepingAction = (type: "in" | "out") => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }
    setTimekeepingChecking(type);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        timekeepingCoordsRef.current = coords;
        if (ATTENDANCE_FACE_CHECK_ENABLED) {
          setTimekeepingChecking(null);
          setTimekeepingCameraAction(type);
          return;
        }
        void submitTimekeeping(type, coords)
          .catch((error) => toast.error(error instanceof Error ? error.message : "Không thể chấm công."))
          .finally(() => setTimekeepingChecking(null));
      },
      (error) => {
        setTimekeepingChecking(null);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Vui lòng cho phép truy cập vị trí trên trình duyệt để chấm công.");
        } else {
          toast.error("Không thể xác định vị trí. Vui lòng thử lại.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const FACE_REASON_MESSAGES: Record<string, string> = {
    invalid_image: "Ảnh không hợp lệ, vui lòng chụp lại.",
    no_face: "Không phát hiện khuôn mặt trong ảnh.",
    multiple_faces: "Ảnh có nhiều khuôn mặt, vui lòng chụp lại một mình.",
    spoof_detected: "Hệ thống nghi ngờ ảnh giả mạo. Vui lòng chụp trực tiếp.",
    face_mismatch: "Khuôn mặt không khớp với hồ sơ đã đăng ký.",
    not_registered: "Bạn chưa đăng ký khuôn mặt. Vui lòng liên hệ quản trị viên.",
    model_unavailable: "Hệ thống nhận diện khuôn mặt tạm thời không khả dụng.",
  };

  const submitTimekeeping = async (
    type: "in" | "out",
    coords: { latitude: number; longitude: number },
    image?: Blob,
  ) => {
    const formData = new FormData();
    if (image) formData.append("file", image, "attendance.jpg");
    formData.append("latitude", String(coords.latitude));
    formData.append("longitude", String(coords.longitude));
    formData.append("deviceInfo", navigator.userAgent);

    const url = type === "in" ? "/api/v1/timekeeping/check-in" : "/api/v1/timekeeping/check-out";
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: formData,
      });
    } catch {
      throw new Error("Lỗi kết nối khi gửi dữ liệu chấm công.");
    }

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reasonMessage = result.reasonCode ? FACE_REASON_MESSAGES[result.reasonCode] : undefined;
      throw new Error(reasonMessage || result.message || `Không thể Check-${type}.`);
    }

    toast.success(result.message || `Check-${type === "in" ? "In" : "Out"} thành công!`);
    timekeepingCoordsRef.current = null;
    await fetchHeaderTimekeeping();
    window.dispatchEvent(new CustomEvent("timekeeping-mutation"));
  };

  const handleTimekeepingCameraCapture = async (image: Blob) => {
    const type = timekeepingCameraAction;
    const coords = timekeepingCoordsRef.current;
    if (!type || !coords) throw new Error("Thiếu vị trí GPS, vui lòng thử lại từ đầu.");
    await submitTimekeeping(type, coords, image);
  };

  const hasCheckIn = !!todayTimekeeping?.checkIn;
  const hasCheckOut = !!todayTimekeeping?.checkOut;

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
    <>
      <header className={isLauncher ? "relative z-40 flex min-w-0 flex-1 items-center justify-end" : "sticky top-0 z-40 flex h-18 min-w-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest pl-1 pr-3 shadow-xs sm:gap-4 sm:pr-6"} id={isLauncher ? "launcher_header_controls" : "app_header"}>
        {!isLauncher && <div className="relative flex min-w-0 flex-1 items-center sm:max-w-2xl">
          <div className="ml-3 flex shrink-0 items-center sm:ml-4">
            {userProfile?.role !== "superadmin" && (
              <button ref={moduleButtonRef} type="button" onClick={() => setShowModuleMenu(true)} aria-label="Mở danh sách phân hệ" aria-haspopup="dialog" aria-expanded={showModuleMenu} className="flex size-11 -translate-y-2 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {[5.5, 12, 18.5].flatMap((cy) =>
                    [5.5, 12, 18.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" />),
                  )}
                </svg>
              </button>
            )}
            <span className="mr-3 flex shrink-0 flex-col items-start justify-center gap-0.5 sm:mr-4">
              <ModuleLauncherLogo compact />
              <span className="font-sans text-xs font-semibold leading-tight text-on-surface">{HEADER_MODULE_LABELS[currentTab]}</span>
            </span>
          </div>
          <div className="relative mx-auto hidden min-w-0 w-full max-w-sm sm:block" id="search_container">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="size-5 text-on-surface-variant" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm trong ERP..."
              className="block h-11 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-12 pr-5 text-sm text-on-surface shadow-md outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-primary/10"
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
        </div>}

        <div className={isLauncher ? "flex min-w-0 items-center gap-1 sm:gap-3" : "ml-1 flex shrink-0 items-center gap-1 sm:ml-6 sm:gap-3"} id="header_controls">

          {userProfile?.role === "admin" && branches.length > 0 && (
            <BranchSwitcher branches={branches} activeBranchId={activeBranchId} onChange={setActiveBranchId} />
          )}


          {/* Attendance Check-In / Check-Out Button */}
          {userProfile && (
            hasCheckOut ? (
              <span
                className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 sm:px-4 py-2 text-xs font-bold text-blue-600 select-none"
                title="Đã hoàn thành chấm công hôm nay"
                id="header_attendance_done"
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Đã chấm công</span>
              </span>
            ) : hasCheckIn ? (
              <button
                onClick={() => handleTimekeepingAction("out")}
                disabled={timekeepingChecking !== null}
                className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 sm:px-4 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${timekeepingChecking === "out"
                    ? "bg-sky-100 border-sky-200 text-[#00ADFC] animate-pulse cursor-wait"
                    : "bg-sky-50 border-sky-100 text-sky-700 hover:bg-sky-100/70 hover:border-sky-200 shadow-sky-500/5"
                  }`}
                title="Check-Out chấm công"
                id="header_checkout_btn"
              >
                {timekeepingChecking === "out" ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#00ADFC] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOutIcon className="h-3.5 w-3.5 shrink-0 text-[#00ADFC]" />
                )}
                <span className="hidden sm:inline">{timekeepingChecking === "out" ? "Đang xử lý..." : "Check-Out"}</span>
              </button>
            ) : (
              <button
                onClick={() => handleTimekeepingAction("in")}
                disabled={timekeepingChecking !== null}
                className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 sm:px-4 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${timekeepingChecking === "in"
                    ? "bg-indigo-100 border-indigo-200 text-indigo-500 animate-pulse cursor-wait"
                    : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/70 hover:border-indigo-200 shadow-indigo-500/5"
                  }`}
                title="Check-In chấm công"
                id="header_checkin_btn"
              >
                {timekeepingChecking === "in" ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline">{timekeepingChecking === "in" ? "Đang xử lý..." : "Check-In"}</span>
              </button>
            )
          )}


          {/* Dark Mode Toggle Button */}
          <button
            type="button"
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
            className="hidden items-center justify-center rounded-full p-2 text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-600 active:scale-95 sm:flex"
            title={isDark ? "Giao diện sáng" : "Giao diện tối"}
            aria-label={isDark ? "Giao diện sáng" : "Giao diện tối"}
            id="header_darkmode_btn"
          >
            {isDark ? <Sun className="h-4.5 w-4.5 shrink-0 text-amber-500" /> : <Moon className="h-4.5 w-4.5 shrink-0" />}
          </button>

          <div className="relative" id="notification_dropdown_button">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-xl p-2.5 text-gray-600 transition-all hover:bg-gray-50 active:scale-95 hidden sm:block"
              aria-label="Thông báo"
              aria-expanded={showNotifications}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-[4.75rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[calc(100vw-1.5rem)] sm:max-w-96">
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
            <button
              ref={profileButtonRef}
              type="button"
              className="flex cursor-pointer select-none items-center gap-3 border-l border-gray-200 bg-transparent pl-4 transition-transform active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              id="user_profile_box"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label={`Tài khoản ${userProfile?.displayName || "iGen Administrator"}`}
              aria-expanded={showProfileMenu}
            >
              <span className="hidden text-right lg:block">
                <span className="text-sm font-semibold text-gray-800 transition-colors hover:text-blue-600">
                  {userProfile ? userProfile.displayName : "iGen Administrator"}
                </span>
              </span>
              {userProfile?.photoURL && (userProfile.photoURL.startsWith("http") || userProfile.photoURL.startsWith("/")) ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="h-9 w-9 rounded-full border border-gray-200 object-cover shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100"
                />
              ) : (
                <span className="flex h-9 w-9 select-none items-center justify-center rounded-full bg-blue-600 text-sm font-bold tracking-wide text-white shadow-md ring-2 ring-blue-50 transition-all hover:ring-blue-100">
                  {userProfile ? userProfile.displayName.slice(0, 2).toUpperCase() : "AD"}
                </span>
              )}
            </button>

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
                        setShowProfileMenu(false);
                        setShowNotifications(true);
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80 sm:hidden"
                    >
                      <Bell className="h-4 w-4 text-blue-500" />
                      <span className="flex-1">Thông báo</span>
                      {unreadCount > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                    </button>
                  {userProfile && !hasCheckOut && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleTimekeepingAction(hasCheckIn ? "out" : "in");
                      }}
                      disabled={timekeepingChecking !== null}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80 sm:hidden disabled:opacity-50"
                    >
                      {hasCheckIn ? <LogOutIcon className="h-4 w-4 text-[#00ADFC]" /> : <LogIn className="h-4 w-4 text-[#00ADFC]" />}
                      <span>{timekeepingChecking ? "Đang xử lý..." : hasCheckIn ? "Check-Out" : "Check-In"}</span>
                    </button>
                  )}
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
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutConfirm(true);
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


        {showTelegramModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onClick={() => setShowTelegramModal(false)}>
            <div className="relative w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
               data-erp-modal-close aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4">
                <div className="mb-2 inline-flex rounded-2xl bg-sky-50 p-2 text-[#00ADFC]">
                  <Send className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Liên kết Telegram</h3>
                <p className="mt-1 text-xs text-gray-500">Chỉ dùng link liên kết từ web, không dùng đăng nhập Telegram nữa.</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-600">Trạng thái</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${telegramLink?.linked ? "bg-sky-100 text-[#00ADFC]" : "border border-gray-200 bg-white text-gray-500"}`}>
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

      <ConfirmDialog
        appearance="erp"
        isOpen={showLogoutConfirm}
        isSubmitting={logoutSubmitting}
        icon="question"
        tone="danger"
        title="Bạn có chắc đăng xuất không?"
        description="Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng iGen ERP."
        cancelLabel="Ở lại"
        confirmLabel="Đăng xuất"
        onClose={closeLogoutConfirm}
        onConfirm={confirmLogout}
      />

      {showModuleMenu && <ModuleQuickMenu currentTab={currentTab} onClose={() => { setShowModuleMenu(false); requestAnimationFrame(() => moduleButtonRef.current?.focus()); }} />}

      {timekeepingCameraAction && (
        <AttendanceCameraModal
          action={timekeepingCameraAction}
          onCapture={handleTimekeepingCameraCapture}
          onClose={() => {
            timekeepingCoordsRef.current = null;
            setTimekeepingCameraAction(null);
          }}
        />
      )}
    </>
  );
}
