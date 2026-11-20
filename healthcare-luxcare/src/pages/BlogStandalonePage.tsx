import React, { useEffect } from "react";
import { ArrowLeft, Megaphone, Shield, User, LogIn, LogOut, ExternalLink, Sparkles, Lock } from "lucide-react";
import { BRAND_NAME, BRAND_LOGO_PATH } from "../config/brand";
import { useAuth } from "../context/AuthContext";
import BlogChannelTab from "./BlogChannelTab";
import { SEOHead } from "../seo/SEOHead";
import { socketService } from "../services/socketService";
import CreateBlogAuthorModal from "../components/blog/CreateBlogAuthorModal";

export default function BlogStandalonePage() {
  const { user, userProfile, loading, logout } = useAuth();
  const [showBlogEditorModal, setShowBlogEditorModal] = React.useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (user && token) {
      socketService.connect(token);
    }
  }, [user]);

  const isEditor = Boolean(
    userProfile?.role === "blog_editor" || userProfile?.role === "blog_author",
  );

  const canPost = Boolean(
    userProfile?.role === "superadmin" ||
    isEditor ||
    (userProfile as any)?.canPostBlog ||
    userProfile?.permissions?.includes("blog:post") ||
    userProfile?.permissions?.includes("blog:publish") ||
    userProfile?.permissions?.includes("*"),
  );

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      localStorage.removeItem("accessToken");
    } finally {
      window.location.href = "/dang-nhap";
    }
  };

  if (!loading && (!user || !userProfile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 font-sans">
        <SEOHead
          meta={{
            title: `Yêu cầu đăng nhập | ${BRAND_NAME}`,
            description: "Vui lòng đăng nhập để truy cập Bảng tin nội bộ",
            keywords: "dang nhap, bang tin noi bo, blog doanh nghiep",
            path: "/blog",
          }}
        />
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Yêu cầu đăng nhập</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Bạn cần đăng nhập tài khoản để xem nội dung trên Kênh Bảng Tin & Blog nội bộ.
          </p>
          <a
            href="/dang-nhap"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-slate-100 dark:bg-slate-950 font-sans overflow-hidden">
      <SEOHead
        meta={{
          title: `Kênh Bảng Tin & Blog Nội Bộ | ${BRAND_NAME}`,
          description: "Kênh truyền thông nội bộ, thông báo chính thức và tin tức doanh nghiệp",
          keywords: "bảng tin nội bộ, blog doanh nghiệp, thông báo nội bộ",
          path: "/blog",
        }}
      />

      {/* ==================== STANDALONE HEADER RIÊNG BIỆT ==================== */}
      <header className="shrink-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Logo & Tên kênh */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <a
              href={isEditor ? "/blog" : "/"}
              className="flex items-center gap-2 group transition-transform active:scale-95 shrink-0"
            >
              <img
                src={BRAND_LOGO_PATH}
                alt={BRAND_NAME}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-contain shadow-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="font-extrabold text-sm sm:text-lg bg-gradient-to-r from-indigo-600 via-rose-600 to-amber-600 bg-clip-text text-transparent truncate">
                {BRAND_NAME}
              </span>
            </a>

          </div>

          {/* Trạng thái quyền & Nút điều hướng */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {user ? (
              <>
                {userProfile?.role === "superadmin" && (
                  <button
                    type="button"
                    onClick={() => setShowBlogEditorModal(true)}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                    title="Cấp tài khoản Ban biên tập hoặc phân quyền đăng bài cho nhân viên"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Cấp tài khoản Ban Biên Tập</span>
                    <span className="md:hidden">Cấp quyền</span>
                  </button>
                )}

                <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                    {userProfile?.displayName || user.email}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  {canPost ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Ban Biên Tập
                    </span>
                  ) : (
                    <span className="font-medium text-slate-500 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Chỉ xem
                    </span>
                  )}
                </div>

                {/* Tài khoản biên tập không có bàn làm việc ERP nên không hiển thị nút này */}
                {!isEditor && (
                  <a
                    href="/"
                    className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-indigo-200/60 dark:border-slate-700 shrink-0"
                    title="Trở về bàn làm việc chính"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Về Bàn Làm Việc</span>
                    <span className="sm:hidden">Làm việc</span>
                  </a>
                )}

                {/* Nút Đăng xuất */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-rose-200 dark:border-rose-900/50 cursor-pointer active:scale-95 shrink-0"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </>
            ) : (
              <a
                href="/dang-nhap"
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ==================== NỘI DUNG GIAO DIỆN NHÓM CHAT BLOG ==================== */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-0 sm:p-3 md:p-6 flex flex-col overflow-hidden">
        <BlogChannelTab />
      </main>

      {/* Modal Cấp Quyền Ban Biên Tập Dành Riêng Cho Superadmin */}
      {userProfile?.role === "superadmin" && (
        <CreateBlogAuthorModal
          open={showBlogEditorModal}
          onClose={() => setShowBlogEditorModal(false)}
        />
      )}
    </div>
  );
}
