import { AI_CREDITS_ENABLED } from "../../shared/features";
import { getRoleDisplayName } from "../utils/permissionUtils";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  LogOut,
  Search,
  Settings,
  Wallet,
  Info,
  X,
  Image,
  Video,
  Volume2,
  FileText,
  Package,
  Megaphone,
  Sparkles,
  CheckCheck,
  ShoppingCart,
  AlertTriangle,
  Send,
  Sun,
  Moon,
  Briefcase,
  GraduationCap,
  LayoutGrid,
  LayoutDashboard,
  Users,
  MessageSquareShare,
  FolderOpen,
  MessageSquare,
  Shield,
  LineChart,
  Menu,
  FolderTree,
  GitBranch,
  Calendar,
  Clock,
  User,
  LogIn,
  LogOut as LogOutIcon,
  Building2,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { authService } from "../services/authService";
import { isTabHidden } from "../config/modules";
import { toast } from "./Toast";
import { notificationService, WebNotification } from "../services/notificationService";
import { socketService } from "../services/socketService";
import AttendanceCameraModal from "../components/attendance/AttendanceCameraModal";
import { ATTENDANCE_FACE_CHECK_ENABLED } from "../config/attendanceFaceCheck";
import DeleteAccountModal from "../components/settings/DeleteAccountModal";

interface HeaderProps {
  currentTab: TabType;
  onSearchSelect: (tab: TabType, subTab?: string) => void;
  onMenuClick?: () => void;
}

const searchIndex = [
  {
    label: "Tổng quan Doanh nghiệp",
    tab: "TỔNG QUAN" as TabType,
    keywords: "tong quan dashboard kpi hieu suat bieu do",
  },
  {
    label: "Sơ đồ tổ chức",
    tab: "NHÂN SỰ" as TabType,
    subTab: "SƠ ĐỒ TỔ CHỨC",
    keywords: "hr so do to chuc nhan su",
  },
  {
    label: "Quản lý Phòng & Phòng ban",
    tab: "NHÂN SỰ" as TabType,
    subTab: "PHÒNG BAN",
    keywords: "hr phong ban danh muc phong co so",
  },
  { label: "Giao Việc", tab: "NHÂN SỰ" as TabType, subTab: "Giao Việc", keywords: "hr giao viec  task list cong viec" },
  {
    label: "Đào tạo e-Learning",
    tab: "NHÂN SỰ" as TabType,
    subTab: "ĐÀO TẠO",
    keywords: "onboarding hoc tap dao tao kien thuc video",
  },
  {
    label: "Lên ý tưởng AI Marketing",
    tab: "MARKETING" as TabType,
    subTab: "LÊN Ý TƯỞNG AI",
    keywords: "viet content y tuong campaign facebook tiktok copywriter",
  },
  {
    label: "Duyệt nội dung Marketing",
    tab: "MARKETING" as TabType,
    subTab: "DUYỆT NỘI DUNG",
    keywords: "duyet content post facebook linkedin tiktok",
  },
  {
    label: "Lịch đăng Content",
    tab: "MARKETING" as TabType,
    subTab: "LỊCH ĐĂNG CONTENT",
    keywords: "lich dang content calendar publish",
  },
  {
    label: "Phễu Khách hàng",
    tab: "SALES CRM" as TabType,
    subTab: "PHỄU KHÁCH HÀNG",
    keywords: "crm phieu khach hang lead cold warm hot",
  },
  {
    label: "Hộp thư đa kênh",
    tab: "SALES CRM" as TabType,
    subTab: "OMNI-INBOX CHAT",
    keywords: "chat vip mailbox tro ly ai",
  },
  {
    label: "Kênh Bảng Tin & Blog",
    tab: "BẢNG TIN" as TabType,
    keywords: "bang tin blog kenh thong bao tin tuc news feed",
  },
];

export default function Header({ currentTab, onSearchSelect, onMenuClick }: HeaderProps) {
  const { userProfile, logout } = useAuth();
  const { branches, activeBranchId, setActiveBranchId, activeBranch } = useBranch();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showUtilities, setShowUtilities] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [telegramLink, setTelegramLink] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [notifs, setNotifs] = useState<WebNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
  });

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
      { enableHighAccuracy: true, timeout: 15000 },
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
      setNotifs((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Lỗi khi đánh dấu đã đọc thông báo:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
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
              item.keywords.toLowerCase().includes(normalizedQuery),
          );

  return (
    <>
      <header
        className="sticky top-0 z-40 flex h-18 items-center justify-between border-b border-gray-100 bg-white px-3 sm:px-6 shadow-xs"
        id="app_header"
      >
        <div className="flex items-center">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="mr-2 sm:mr-3 md:hidden p-1.5 sm:p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:scale-95 cursor-pointer shrink-0"
              title="Mở menu"
              id="header_menu_btn"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="ml-1 sm:ml-6 flex items-center gap-1 sm:gap-3 flex-1 justify-end min-w-0" id="header_controls">
          {userProfile?.role === "admin" && branches.length > 0 && (
            <div
              className="flex min-w-0 items-center gap-1 sm:gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2 sm:px-2.5 py-1.5 text-emerald-800 shadow-sm"
              title={`Chi nhánh đang xem: ${activeBranch?.name || ""}`}
            >
              <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="hidden whitespace-nowrap text-[11px] font-bold leading-none text-emerald-800 sm:inline">Chi nhánh</span>
              <div className="relative inline-flex items-center min-w-0">
                <select
                  aria-label="Chi nhánh đang chọn"
                  value={activeBranchId}
                  onChange={(e) => setActiveBranchId(e.target.value)}
                  className="max-w-[100px] xs:max-w-[160px] sm:max-w-[195px] md:max-w-xs min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-4 text-[11px] font-bold leading-none text-emerald-900 outline-none"
                >
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id} className="bg-white text-slate-800">
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
              </div>
            </div>
          )}



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
              <div
                className={`fixed sm:absolute left-3 sm:left-auto right-3 sm:right-0 top-18 sm:top-auto z-50 mt-0 sm:mt-3 w-auto sm:w-[580px] max-w-none sm:max-w-[580px] max-h-[80vh] overflow-y-auto rounded-3xl p-4 sm:p-6 shadow-2xl font-sans animate-fade-in border ${isDark ? "bg-[#18181b] text-neutral-100 border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : "bg-white text-slate-800 border-gray-150"}`}
              >
                {/* Header */}
                <div
                  className={`flex items-center justify-between border-b pb-3.5 mb-2 ${isDark ? "border-neutral-800" : "border-gray-100"}`}
                >
                  <span className={`text-base font-bold tracking-wide ${isDark ? "text-white" : "text-slate-800"}`}>
                    Menu
                  </span>
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
                  <div
                    className={`flex-[1.6] sm:pr-6 pb-4 sm:pb-0 border-b sm:border-b-0 sm:border-r ${isDark ? "border-neutral-800/85" : "border-gray-100"}`}
                  >
                    {/* Group Yêu thích */}
                    <div>
                      <h3
                        className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}
                      >
                        Yêu thích
                      </h3>
                      <div className="space-y-1">
                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "PHÒNG BAN");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <Building2 className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Phòng ban
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Quản lý các phòng ban
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "QUY TRÌNH");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <GitBranch className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Quy trình công việc
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Quy trình làm việc
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Group Tính năng */}
                    <div className="mt-5">
                      <h3
                        className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}
                      >
                        Tính năng
                      </h3>
                      <div
                        className={`space-y-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent ${isDark ? "scrollbar-thumb-neutral-800" : "scrollbar-thumb-gray-200"}`}
                      >
                        <div
                          onClick={() => {
                            onSearchSelect("TỔNG QUAN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <LayoutDashboard className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Tổng quan
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Xem tổng quát hoạt động
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Việc của tôi
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Các công việc của tôi
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <MessageSquare className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Nhắn tin & gọi điện
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Trò chuyện và gọi điện audio/video
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <Video className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Cuộc họp trực tuyến
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Tạo cuộc họp trực tuyến giống như Zoom, Google Meet
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <Calendar className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Lịch
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Lịch công việc và sự kiện
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("QUẢN LÝ TÀI NGUYÊN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <FolderOpen className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Tài nguyên
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Các tài nguyên (files, docs, links...)
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <Users className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Nhóm của tôi
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Các nhóm làm việc và trò chuyện
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-start gap-3.5 py-2 px-3 rounded-2xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <div
                            className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                          >
                            <Briefcase className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                            >
                              Lĩnh vực, dự án
                            </p>
                            <p
                              className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                            >
                              Lĩnh vực hoạt động và dự án
                            </p>
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
                            <div
                              className={`p-2 border rounded-xl transition-all mt-0.5 ${isDark ? "bg-neutral-800/50 border-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-800" : "bg-slate-50 border-gray-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100"}`}
                            >
                              <Shield className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-[13px] font-bold transition-colors ${isDark ? "text-neutral-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}
                              >
                                Thành viên
                              </p>
                              <p
                                className={`text-[11px] font-normal leading-normal mt-0.5 ${isDark ? "text-neutral-400" : "text-slate-500"}`}
                              >
                                Quản lý thành viên & phân quyền
                              </p>
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
                      <h3
                        className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 mt-2 ${isDark ? "text-neutral-500" : "text-slate-400"}`}
                      >
                        Tạo
                      </h3>
                      <div className="space-y-1">
                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "Giao Việc");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <FileText
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Công việc
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <Users
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Nhóm
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <MessageSquare
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Nhắn tin
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("TRÒ CHUYỆN" as TabType);
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <Video
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Cuộc gọi video
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Group Cá nhân */}
                    <div className={`mt-5 border-t pt-4 ${isDark ? "border-neutral-800/80" : "border-gray-100"}`}>
                      <h3
                        className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-neutral-500" : "text-slate-400"}`}
                      >
                        Cá nhân
                      </h3>
                      <div className="space-y-1">
                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <Calendar
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Nghỉ phép
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <Calendar
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Sự kiện
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            onSearchSelect("NHÂN SỰ" as TabType, "LỊCH");
                            setShowUtilities(false);
                          }}
                          className={`group flex items-center gap-3 py-2 px-3 rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-neutral-800/40" : "hover:bg-slate-50"}`}
                        >
                          <Clock
                            className={`h-4 w-4 transition-colors ${isDark ? "text-neutral-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-800"}`}
                          />
                          <span
                            className={`text-[13px] font-semibold transition-colors ${isDark ? "text-neutral-300 group-hover:text-white" : "text-slate-650 group-hover:text-slate-900"}`}
                          >
                            Nhắc nhở
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {showUtilities && <div className="fixed inset-0 z-[-1]" onClick={() => setShowUtilities(false)} />}
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
              <div className="relative">
                {userProfile?.photoURL &&
                (userProfile.photoURL.startsWith("http") || userProfile.photoURL.startsWith("/")) ? (
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
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-mono text-[9px] font-bold text-white ring-2 ring-white animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
            </div>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-gray-100 bg-white py-2 font-sans shadow-2xl backdrop-blur-md">
                  <div className="border-b border-gray-100 px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tài khoản</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-gray-800">{userProfile?.displayName}</p>
                    <p className="truncate text-xs text-gray-500">{userProfile?.email}</p>
                    {userProfile?.role && (
                      <span className="mt-1 inline-block rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-blue-600">
                        {getRoleDisplayName(userProfile.role)}
                      </span>
                    )}
                  </div>

                  {/* Notifications integrated in profile dropdown */}
                  <div className="border-b border-gray-100">
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                      <span className="text-[11px] font-bold text-gray-700">Thông báo ({unreadCount})</span>
                      <button
                        onClick={markAllRead}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer bg-transparent border-0"
                      >
                        Đọc tất cả
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                      {notifs.length === 0 ? (
                        <p className="p-4 text-center text-[11px] text-gray-400">Không có thông báo</p>
                      ) : (
                        notifs.slice(0, 5).map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => {
                              markRead(notif._id);
                              if (notif.action) {
                                onSearchSelect(notif.action.tab as any, notif.action.subTab);
                                setShowProfileMenu(false);
                              }
                            }}
                            className={`flex cursor-pointer items-start gap-2.5 p-3 hover:bg-gray-50 transition-colors ${notif.read ? "opacity-50" : ""}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-[11px] leading-snug ${notif.read ? "text-gray-500 font-medium" : "text-gray-800 font-bold"}`}>
                                {notif.title}
                              </p>
                              <p className="text-[10px] text-gray-450 line-clamp-1 mt-0.5 leading-relaxed">{notif.body}</p>
                            </div>
                            {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Attendance Check-in / Check-out integrated in profile dropdown */}
                  {userProfile && (
                    <div className="border-b border-gray-100 p-3 bg-slate-50/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Chấm công hôm nay</p>
                      {hasCheckOut ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 border border-blue-150 p-2.5 text-xs font-bold text-blue-600 select-none">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>Đã hoàn thành chấm công</span>
                        </div>
                      ) : hasCheckIn ? (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleTimekeepingAction("out");
                          }}
                          disabled={timekeepingChecking !== null}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all active:scale-98 cursor-pointer shadow-xs ${
                            timekeepingChecking === "out"
                              ? "bg-emerald-100 border-emerald-200 text-emerald-500 animate-pulse"
                              : "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600 shadow-sm"
                          }`}
                        >
                          {timekeepingChecking === "out" ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LogOutIcon className="h-4 w-4 text-white" />
                          )}
                          <span>{timekeepingChecking === "out" ? "Đang check-out..." : "Check-Out"}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleTimekeepingAction("in");
                          }}
                          disabled={timekeepingChecking !== null}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all active:scale-98 cursor-pointer shadow-xs ${
                            timekeepingChecking === "in"
                              ? "bg-indigo-100 border-indigo-200 text-indigo-500 animate-pulse"
                              : "bg-indigo-650 border-indigo-700 text-white hover:bg-indigo-700 shadow-sm"
                          }`}
                        >
                          {timekeepingChecking === "in" ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LogIn className="h-4 w-4 text-white" />
                          )}
                          <span>{timekeepingChecking === "in" ? "Đang check-in..." : "Check-In"}</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="p-1">
                    {AI_CREDITS_ENABLED && (
                      <button
                        onClick={() => {
                          onSearchSelect("VÍ & NẠP TIỀN");
                          setShowProfileMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-blue-50/80"
                      >
                        <Wallet className="h-4 w-4 text-blue-500" />
                        <span>Ví & Nạp tiền</span>
                      </button>
                    )}
                    <a
                      href="/blog"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-indigo-50/80 hover:text-indigo-600"
                    >
                      <Megaphone className="h-4 w-4 text-indigo-500" />
                      <span>Kênh Bảng Tin & Blog</span>
                    </a>
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
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowDeleteAccountModal(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50/80"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      <span>Xóa tài khoản</span>
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

        {showTelegramModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
            onClick={() => setShowTelegramModal(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
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
                <p className="mt-1 text-xs text-gray-500">
                  Chỉ dùng link liên kết từ web, không dùng đăng nhập Telegram nữa.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-600">Trạng thái</span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${telegramLink?.linked ? "bg-emerald-100 text-emerald-700" : "border border-gray-200 bg-white text-gray-500"}`}
                  >
                    {telegramLink?.linked ? "Đã liên kết" : "Chưa liên kết"}
                  </span>
                </div>
                {telegramLink?.linked && (
                  <p className="mt-2 text-[11px] text-gray-500">Telegram đã được liên kết với tài khoản này.</p>
                )}
                {!telegramLink?.linked && telegramLink?.pendingCode && (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Web sẽ tự cập nhật ngay sau khi bạn liên kết xong trên Telegram.
                  </p>
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
                  <p className="mt-2 text-[11px] text-gray-500">
                    Thông thường chỉ cần bấm link mở bot ở trên. Lệnh này chỉ là phương án dự phòng.
                  </p>
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

        <DeleteAccountModal
          isOpen={showDeleteAccountModal}
          onClose={() => setShowDeleteAccountModal(false)}
        />
      </header>

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
