/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, lazy } from "react";
import { RefreshCw } from "lucide-react";
import Sidebar from "./pages/Sidebar";
import Header from "./pages/Header";
import { ToastContainer } from "./pages/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChatUnreadProvider, useChatUnread } from "./context/ChatUnreadContext";
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

const UNREAD_TITLE_PREFIX_RE = /^\(\d+\+?\d*\)\s/;

const AuthPage = lazy(() => import("./pages/AuthPage"));
const ChatbotWidget = lazy(() =>
  import("./components/common/ChatbotWidget").then((m) => ({ default: m.ChatbotWidget }))
);
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const UserDataDeletion = lazy(() => import("./pages/UserDataDeletion"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const currentPath = normalizePublicPath(window.location.pathname);
  const isLandingPage = currentPath === "/" || currentPath === "/landing" || currentPath === "/landing.html";
  const isLandingGuestPage = isLandingPage && !(user && userProfile);
  const isPrivacyPage = currentPath === "/privacy-policy" || currentPath === "/privacy-policy.html";
  const isTermsPage = currentPath === "/terms-of-service" || currentPath === "/terms-of-service.html";
  const isDeletionPage = currentPath === "/user-data-deletion" || currentPath === "/user-data-deletion.html";
  const isLegalPublicPage = isPrivacyPage || isTermsPage || isDeletionPage;
  const isPublicPage = isLandingGuestPage || isLegalPublicPage;

  const { activeTab, setActiveTab } = useTabRouter({
    enabled: !isPublicPage && !loading && Boolean(user && userProfile),
  });

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
      browserNotificationService.show(`Tin nhắn mới từ ${msg.senderName || "đồng nghiệp"}`, {
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
    <div className="flex h-dvh w-screen overflow-hidden bg-background font-sans text-on-surface" id="app_root_layout">
      <SEOHead meta={getSeoForTab(activeTab)} />
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden" id="main_content_area">
        <Header
          currentTab={activeTab}
          onSearchSelect={handleSearchNavigation}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main
          className={`flex-1 overflow-hidden bg-surface ${
            activeTab === "TRÒ CHUYỆN" ? "p-0 sm:p-6" : "p-3 sm:p-6"
          }`}
          id="primary_page_container"
        >
          <AppRouterView activeTab={activeTab} userProfile={userProfile} />
        </main>
      </div>

      {/* Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp */}
      <Suspense fallback={null}>
        <ChatbotWidget />
      </Suspense>

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

export default function App() {
  if (isSuperAdminPath(window.location.pathname)) {
    return <SuperAdminShell />;
  }

  return (
    <AuthProvider>
      <ChatUnreadProvider>
        <AppContent />
        <ToastContainer />
      </ChatUnreadProvider>
    </AuthProvider>
  );
}

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] text-sm font-semibold text-slate-500">
      Đang tải trang đăng nhập...
    </div>
  );
}
