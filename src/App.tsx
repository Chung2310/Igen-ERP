/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, lazy } from "react";
import { RefreshCw } from "lucide-react";
import Sidebar from "./pages/Sidebar";
import Header from "./pages/Header";
import { ToastContainer } from "./pages/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChatUnreadProvider, useChatUnread } from "./context/ChatUnreadContext";
import { BranchProvider } from "./context/BranchContext";
import type { TabType } from "./types";
import { SEOHead } from "./seo/SEOHead";
import { AUTH_SEO, getSeoForTab, tabToPath } from "./seo/seo-config";
import { AppRouterView, useTabRouter } from "./router";
import { subTabToSlug } from "./router/subTabRoutes";
import { socketService } from "./services/socketService";
import { NotificationToastContainer } from "./components/notification/NotificationToastContainer";
import { browserNotificationService } from "./services/browserNotificationService";
import { pushService } from "./services/pushService";
import { setFaviconBadge } from "./utils/faviconBadge";
import SuperAdminShell from "./pages/super-admin/SuperAdminShell";
import { isSuperAdminPath } from "./router/superAdminRoute";
import { resolveEnabledTab } from "./config/modules";

const UNREAD_TITLE_PREFIX_RE = /^\(\d+\+?\d*\)\s/;

const AuthPage = lazy(() => import("./pages/AuthPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const UserDataDeletion = lazy(() => import("./pages/UserDataDeletion"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const QRCheckinPage = lazy(() => import("./modules/student-management/pages/QRCheckin/QRCheckinPage"));
const WorkerQRCheckinPage = lazy(() => import("./modules/worker-management/pages/WorkerQRCheckinPage"));
const SubmitProofPage = lazy(() => import("./pages/SubmitProofPage"));
const PublicRegisterPage = lazy(() => import("./pages/PublicRegisterPage"));
const PublicRepairFeedbackPage = lazy(() => import("./modules/repair/pages/PublicRepairFeedbackPage"));

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const currentPath = normalizePublicPath(window.location.pathname);
  const isLandingPage = currentPath === "/" || currentPath === "/landing" || currentPath === "/landing.html";
  const isLandingGuestPage = isLandingPage && !(user && userProfile);
  const isPrivacyPage = currentPath === "/privacy-policy" || currentPath === "/privacy-policy.html";
  const isTermsPage = currentPath === "/terms-of-service" || currentPath === "/terms-of-service.html";
  const isDeletionPage = currentPath === "/user-data-deletion" || currentPath === "/user-data-deletion.html";
  const isSubmitProofPage = currentPath.startsWith("/public/submit-proof");
  const isPublicRegisterPage = currentPath.startsWith("/public/dang-ky");
  const isLegalPublicPage = isPrivacyPage || isTermsPage || isDeletionPage;
  const isPublicPage = isLandingGuestPage || isLegalPublicPage || isSubmitProofPage || isPublicRegisterPage;

  const { activeTab, setActiveTab } = useTabRouter({

    enabled: !isPublicPage && !loading && Boolean(user && userProfile),
  });
  // Giảng viên chỉ làm việc tại Lớp học. Nếu gõ/thăm lại URL Nhân sự cũ,
  // chuyển thẳng về Quản lý học viên thay vì để trang HR gọi API không có quyền.
  const teacherSafeTab = userProfile?.role === "teacher" && activeTab === "NHÂN SỰ"
    ? "QUẢN LÝ HỌC VIÊN" as TabType
    : activeTab;
  const resolvedActiveTab = resolveEnabledTab(teacherSafeTab, userProfile?.enabledModules, userProfile?.businessType);

  React.useEffect(() => {
    if (resolvedActiveTab !== activeTab) setActiveTab(resolvedActiveTab);
  }, [activeTab, resolvedActiveTab, setActiveTab]);

  React.useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (user && token) {
      console.log("[App] Connecting global socket...");
      socketService.connect(token);
    } else {
      console.log("[App] Disconnecting global socket...");
      socketService.disconnect();
    }
  }, [user]);

  // Thông báo tin nhắn mới khi người dùng không xem giao diện:
  // - Tab bị ẩn/thu nhỏ → Notification API (tại đây)
  // - Đóng hẳn tab → Web Push qua Service Worker (server đẩy cho thành viên offline)
  React.useEffect(() => {
    if (!user || !userProfile) return;

    void (async () => {
      const permission = await browserNotificationService.requestPermission();
      if (permission === "granted") {
        await pushService.subscribe();
      }
    })();

    const unsubscribe = socketService.on("internal_new_message", (data: any) => {
      const msg = data?.message;
      if (!msg) return;
      const senderId = msg.senderId && typeof msg.senderId === "object" ? msg.senderId._id : msg.senderId;
      if (senderId === userProfile.uid) return;
      if (!document.hidden) return; // Đang xem giao diện — âm thanh/badge trong app đã lo

      const body = msg.content && msg.content.trim() ? msg.content.slice(0, 120) : "Đã gửi tệp đính kèm";
      const isMentioned = msg.content && (
        msg.content.includes("@all") ||
        msg.content.includes("@Tất cả") ||
        msg.content.includes("@tất cả") ||
        (userProfile.displayName && msg.content.includes(`@${userProfile.displayName}`))
      );
      const title = isMentioned
        ? `📢 [Nhắc đến bạn] ${msg.senderName || "Đồng nghiệp"}`
        : `Tin nhắn mới từ ${msg.senderName || "đồng nghiệp"}`;

      browserNotificationService.show(title, {
        body,
        tag: `chat-${data.roomId}`,
        onClick: () => setActiveTab("TRÒ CHUYỆN" as TabType),
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile?.uid]);

  React.useEffect(() => {
    if (!user || !userProfile) {
      document.documentElement.classList.remove("dark");
    } else {
      const theme = localStorage.getItem("theme");
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [user, userProfile]);

  const { totalUnread } = useChatUnread();

  // Chạy sau effect của SEOHead trong cùng lượt commit (component con luôn chạy effect
  // trước component cha) nên luôn bóc tiền tố cũ rồi gắn lại trên title mới nhất.
  React.useEffect(() => {
    const rawTitle = document.title.replace(UNREAD_TITLE_PREFIX_RE, "");
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? "99+" : totalUnread}) ${rawTitle}` : rawTitle;
    void setFaviconBadge(totalUnread);
  }, [totalUnread, activeTab]);

  if (isLandingGuestPage) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (isSubmitProofPage) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <SubmitProofPage />
      </Suspense>
    );
  }

  if (isPublicRegisterPage) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <PublicRegisterPage />
      </Suspense>
    );
  }


  if (isLegalPublicPage) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-10 px-4 font-sans overflow-y-auto">
        <div className="flex-1">
          <Suspense fallback={<AuthLoader />}>
            {isPrivacyPage ? (
              <PrivacyPolicy />
            ) : isTermsPage ? (
              <TermsOfService />
            ) : (
              <UserDataDeletion />
            )}
          </Suspense>
        </div>
        <div className="mt-8 text-center text-xs text-slate-400">
          <a href="/dang-nhap" className="font-semibold text-slate-500 hover:text-blue-600 underline">
            Quay lại trang Đăng nhập
          </a>
        </div>
      </div>
    );
  }

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
        <Suspense fallback={<AuthLoader />}>
          <AuthPage />
        </Suspense>
      </>
    );
  }

  const handleSearchNavigation = (tab: TabType, subTab?: string) => {
    // Cập nhật URL (path của tab đích + ?sub=) TRƯỚC khi phát popstate — nếu phát
    // popstate khi pathname còn là tab cũ, useTabRouter sẽ resolve ngược về tab cũ.
    const url = new URL(window.location.href);
    url.pathname = tabToPath(tab);
    const slug = subTab ? subTabToSlug(tab, subTab) : "";
    if (slug) {
      url.searchParams.set("sub", slug);
    } else {
      url.searchParams.delete("sub");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
    setActiveTab(tab);
    // popstate để useSubTabRouter của trang đang mở đọc lại ?sub= từ URL mới
    window.dispatchEvent(new Event("popstate"));
    console.log(`Global Navigation search redirected to Tab: ${tab}, Section: ${subTab || "None"}`);
  };

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-background font-sans text-on-surface" id="app_root_layout">
      <SEOHead meta={getSeoForTab(resolvedActiveTab)} />
      <Sidebar
        activeTab={resolvedActiveTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden" id="main_content_area">
        <Header
          currentTab={resolvedActiveTab}
          onSearchSelect={handleSearchNavigation}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main
          className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface ${
            activeTab === "TRÒ CHUYỆN" ? "p-0 sm:p-6" : "p-3 sm:p-6"
          }`}
          id="primary_page_container"
        >
          <AppRouterView activeTab={resolvedActiveTab} userProfile={userProfile} />
        </main>
      </div>

      {/* Popup thông báo nổi thời gian thực ở góc dưới bên phải màn hình */}
      <NotificationToastContainer onNavigate={handleSearchNavigation} />
    </div>
  );
}

function normalizePublicPath(pathname: string) {
  const normalized = pathname.toLowerCase().trim();
  if (!normalized || normalized === "/") return "/";
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

type AppErrorBoundaryState = { error: Error | null };

/** Keep a route/runtime exception from leaving the entire ERP as a blank page. */
class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[App] Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-800">
        <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-black text-rose-700">Không thể hiển thị trang</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ứng dụng gặp lỗi khi tải màn hình này. Hãy tải lại trang; nếu lỗi lặp lại, gửi phần thông báo bên dưới cho bộ phận kỹ thuật.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-500">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white"
          >
            Tải lại trang
          </button>
        </section>
      </main>
    );
  }
}

export default function App() {
  if (normalizePublicPath(window.location.pathname).startsWith("/repair/feedback/")) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <PublicRepairFeedbackPage />
      </Suspense>
    );
  }

  // Các trang chấm công công khai chạy trên máy lao động, không có ai xem console
  // để báo lỗi. Thiếu ErrorBoundary thì mọi exception (kể cả lỗi tải chunk sau khi
  // deploy) chỉ để lại màn hình trắng câm, không lần ra được nguyên nhân.
  if (window.location.pathname.startsWith("/worker/checkin/")) {
    return (
      <AppErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950 to-orange-950 flex justify-center items-center text-xs font-semibold text-slate-400">
            Đang tải trang chấm công...
          </div>
        }>
          <WorkerQRCheckinPage />
        </Suspense>
      </AppErrorBoundary>
    );
  }

  if (window.location.pathname.startsWith("/attendance/checkin/")) {
    return (
      <AppErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen bg-slate-900 flex justify-center items-center text-xs font-semibold text-slate-400">
            Đang tải trang điểm danh...
          </div>
        }>
          <QRCheckinPage />
        </Suspense>
      </AppErrorBoundary>
    );
  }

  if (isSuperAdminPath(window.location.pathname)) {
    return <><SuperAdminShell /><ToastContainer /></>;
  }

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ChatUnreadProvider>
          <BranchProvider>
            <AppContent />
          </BranchProvider>
          <ToastContainer />
        </ChatUnreadProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] text-sm font-semibold text-slate-500">
      Đang tải trang đăng nhập...
    </div>
  );
}
