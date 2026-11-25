import { superAdminRequest } from "../../services/superAdminRequest";
import { getApiErrorMessage } from "../../utils/errorMessage";
import React from "react";
import { cn } from "../../modules/student-management/lib/utils";
import { EnvironmentBanner } from "../../components/super-admin/EnvironmentBanner";
import { superAdminAuthService } from "../../services/superAdminAuthService";
import { DashboardTab } from "../../components/super-admin/DashboardTab";
import { ActivityMonitorPage } from "./activity/ActivityMonitorPage";
import { AuditTab } from "../../components/super-admin/AuditTab";
import { SessionsTab } from "../../components/super-admin/SessionsTab";
import { TenantListPage } from "./tenants/TenantListPage";
import { TenantDetailPage } from "./tenants/TenantDetailPage";
import { UserManagementPanel } from "./users/UserManagementPanel";
import { SuperAdminAccountsPage } from "./admins/SuperAdminAccountsPage";
import AiSubscriptionsPage from "./subscriptions/AiSubscriptionsPage";
import { LogOut, Menu, X } from "lucide-react";
import { getSidebarArtworkIcon, type SidebarArtworkName } from "../../components/common/SidebarMenuIcon";
import {
  clearPendingSuperAdminChallenge,
  savePendingSuperAdminChallenge,
} from "../../services/pendingSuperAdminChallenge";
import "./super-admin-theme.css";

export default function SuperAdminShell() {
  const [pendingChallenge] = React.useState(() => null);
  const [stage, setStage] = React.useState<"password" | "enroll" | "totp" | "recovery" | "authenticated">(
    localStorage.getItem("accessToken") ? "authenticated" : "password"
  );
  
  const [activeTab, setActiveTab] = React.useState<"overview" | "activity" | "audit" | "sessions" | "tenants" | "users" | "admins" | "subscriptions">("overview");
  const [selectedTenantCode, setSelectedTenantCode] = React.useState<string | null>(null);
  const [challenge, setChallenge] = React.useState(pendingChallenge?.challengeId || "");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [environment, setEnvironment] = React.useState<"staging" | "production">("staging");
  const [error, setError] = React.useState("");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const mobileNavRef = React.useRef<HTMLDialogElement>(null);
  const enrollmentHydrated = React.useRef(false);

  React.useEffect(() => {
    const dialog = mobileNavRef.current;
    if (!dialog) return;
    if (sidebarOpen && !dialog.open) dialog.showModal();
    else if (!sidebarOpen && dialog.open) dialog.close();
  }, [sidebarOpen, stage]);

  React.useEffect(() => {
    const closeDesktopDrawer = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener("resize", closeDesktopDrawer);
    return () => window.removeEventListener("resize", closeDesktopDrawer);
  }, []);

  React.useEffect(() => {
    clearPendingSuperAdminChallenge(sessionStorage);
  }, []);

  React.useEffect(() => {
    if (stage !== "enroll" || !pendingChallenge || enrollmentHydrated.current) return;
    enrollmentHydrated.current = true;
    superAdminAuthService.startEnrollment(pendingChallenge.challengeId)
      .then((enrollment) => setQr(enrollment.qrDataUrl))
      .catch((cause: any) => {
        clearPendingSuperAdminChallenge(sessionStorage);
        setChallenge("");
        setStage("password");
        setError(getApiErrorMessage(cause, "Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại."));
      });
  }, [pendingChallenge, stage]);

  React.useEffect(() => {
    if (stage === "authenticated") {
      superAdminAuthService.environment()
        .then((v) => setEnvironment(v.environment))
        .catch(() => {
          localStorage.removeItem("accessToken");
          setStage("password");
        });
    }
  }, [stage]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await superAdminAuthService.login(email, password);
      if (r.accessToken) {
        clearPendingSuperAdminChallenge(sessionStorage);
        setStage("authenticated");
        return;
      }
      if (r.status !== "challenge_required") {
        throw new Error("Tài khoản không yêu cầu xác thực quản trị viên tối cao");
      }
      setChallenge(r.challengeId);
      savePendingSuperAdminChallenge(sessionStorage, {
        challengeId: r.challengeId,
        enrollmentRequired: Boolean(r.enrollmentRequired),
        expiresAt: r.expiresAt,
      });
      if (r.enrollmentRequired) {
        const enrollment = await superAdminAuthService.startEnrollment(r.challengeId);
        setQr(enrollment.qrDataUrl);
        setStage("enroll");
      } else {
        setStage("totp");
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Đăng nhập thất bại"));
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r =
        stage === "enroll"
          ? await superAdminAuthService.confirmEnrollment(challenge, code)
          : stage === "recovery"
          ? await superAdminAuthService.verifyRecovery(challenge, code)
          : await superAdminAuthService.verifyTotp(challenge, code);

      clearPendingSuperAdminChallenge(sessionStorage);

      if (r.recoveryCodes) {
        setRecoveryCodes(r.recoveryCodes);
        return;
      }
      setQr("");
      setCode("");
      setStage("authenticated");
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Xác minh thất bại"));
    }
  };

  const handleLogout = async () => {
    try {
      // call logout endpoint if needed
      await superAdminRequest("/api/v1/super-admin/auth/logout", { method: "POST" }).catch(() => {});
    } finally {
      localStorage.removeItem("accessToken");
      clearPendingSuperAdminChallenge(sessionStorage);
      setStage("password");
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "activity":
        return <ActivityMonitorPage />;
      case "audit":
        return <AuditTab />;
      case "sessions":
        return <SessionsTab />;
      case "tenants":
        return selectedTenantCode ? (
          <TenantDetailPage code={selectedTenantCode} onBack={() => setSelectedTenantCode(null)} />
        ) : (
          <TenantListPage onSelect={setSelectedTenantCode} />
        );
      case "users":
        return <UserManagementPanel tenantId="SYSTEM" />;
      case "admins":
        return <SuperAdminAccountsPage />;
      case "subscriptions":
        return <AiSubscriptionsPage />;
      case "overview":
      default:
        return <DashboardTab />;
    }
  };

  const navItems = [
    { id: "overview" as const, label: "Tổng quan hệ thống", artwork: "overview" },
    { id: "activity" as const, label: "Giám sát hoạt động", artwork: "chart" },
    { id: "audit" as const, label: "Nhật ký kiểm toán", artwork: "document" },
    { id: "users" as const, label: "Quản trị tài khoản", artwork: "user" },
    { id: "admins" as const, label: "Tài khoản Super Admin", artwork: "shield" },
    { id: "tenants" as const, label: "Quản lý doanh nghiệp", artwork: "warehouse" },
    { id: "subscriptions" as const, label: "Gói cước & hạn mức", artwork: "package" },
    { id: "sessions" as const, label: "Quản lý phiên làm việc", artwork: "device" },
  ];

  const handleNavClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setSelectedTenantCode(null);
    setSidebarOpen(false);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="space-y-6 flex-1">
        <div>
          <h1 className="text-xl font-black text-on-surface tracking-wider">BẢNG ĐIỀU KHIỂN</h1>
          <p className="mt-1 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Không gian Quản trị Tối cao
          </p>
        </div>
        <nav className="mt-6 block space-y-2">
          {navItems.map(({ id, label, artwork }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => handleNavClick(id)}
              className={cn("group w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
                activeTab === id
                  ? "bg-surface-container-low text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low focus-visible:bg-surface-container-low"
              )}
            >
              <span aria-hidden="true" className="relative size-5 shrink-0 text-[#2196f3] [&_svg]:size-5">
                <span className={`${activeTab === id ? "hidden" : "group-hover:hidden group-focus-visible:hidden"} absolute inset-0`}>{getSidebarArtworkIcon(artwork as SidebarArtworkName)}</span>
                <span className={`${activeTab === id ? "" : "hidden group-hover:block group-focus-visible:block"} absolute inset-0`}>{getSidebarArtworkIcon(artwork as SidebarArtworkName, true)}</span>
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-error hover:bg-surface-container-low transition-all border border-transparent mt-4"
      >
        <LogOut className="size-5 shrink-0" />
        Đăng xuất
      </button>
    </div>
  );

  if (stage === "authenticated") {
    return (
      <div className="super-admin-shell min-h-dvh bg-surface-container-lowest text-on-surface flex flex-col font-sans">
        <EnvironmentBanner environment={environment} />

        {/* Mobile Top Navigation Bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <div>
            <span className="text-sm font-black text-on-surface tracking-wider">BẢNG ĐIỀU KHIỂN</span>
            <span className="ml-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hidden sm:inline">
              Quản trị Tối cao
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container p-2 text-on-surface-variant transition-all"
            aria-label="Mở menu điều hướng"
            aria-haspopup="dialog"
            aria-expanded={sidebarOpen}
            aria-controls="super-admin-mobile-nav"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile Slide-over Drawer */}
        <dialog
          id="super-admin-mobile-nav"
          ref={mobileNavRef}
          aria-label="Điều hướng Super Admin"
          onCancel={() => setSidebarOpen(false)}
          onClose={() => setSidebarOpen(false)}
          className={cn("fixed inset-y-0 left-0 z-50 m-0 h-dvh max-h-dvh w-72 flex-col border-r border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-2xl backdrop:bg-black/60 lg:hidden", sidebarOpen ? "flex" : "hidden")}
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-black text-on-surface tracking-wider">BẢNG ĐIỀU KHIỂN</h1>
              <p className="mt-0.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Quản trị Tối cao
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container p-2 text-on-surface-variant hover:text-on-surface transition-all"
              aria-label="Đóng menu"
             data-erp-modal-close>
              <X className="h-4 w-4" />
            </button>
          </div>
          <NavContent />
        </dialog>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest p-6">
            <NavContent />
          </aside>

          {/* Main workspace */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface-container-lowest px-3 py-2.5">
            {renderActiveTab()}
          </main>
        </div>
      </div>
    );
  }


  return (
    <main className="super-admin-shell min-h-dvh bg-surface-container-lowest text-on-surface grid place-items-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-8 shadow-2xl">
        <p className="text-xs font-bold tracking-[.3em] text-cyan-400 uppercase">Quản trị Tối cao iGen</p>
        <h1 className="mt-3 text-2xl font-black">Đăng nhập đặc quyền</h1>
        
        {error && (
          <p className="mt-4 rounded-xl bg-error-container border border-error/20 p-3 text-sm text-error">
            {error}
          </p>
        )}

        {stage === "password" ? (
          <form onSubmit={submitPassword} className="mt-8 space-y-4">
            <input
              className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant p-3 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant p-3 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 p-3 text-sm font-bold text-slate-950 transition-all">
              Tiếp tục
            </button>
          </form>
        ) : recoveryCodes.length ? (
          <div className="mt-6 space-y-4">
            <p className="text-amber-800 text-sm">
              Lưu các mã khôi phục này ngay. Chúng chỉ hiển thị một lần duy nhất.
            </p>
            <pre className="rounded-xl bg-surface-container-low border border-outline-variant p-4 text-sm font-mono text-on-surface-variant leading-relaxed">
              {recoveryCodes.join("\n")}
            </pre>
            <button
              onClick={() => {
                setRecoveryCodes([]);
                setQr("");
                clearPendingSuperAdminChallenge(sessionStorage);
                setStage("authenticated");
              }}
              className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 p-3 text-sm font-bold text-slate-950 transition-all"
            >
              Tôi đã lưu mã khôi phục
            </button>
          </div>
        ) : (
          <form onSubmit={submitCode} className="mt-6 space-y-4">
            {qr && (
              <div className="bg-white p-3 rounded-2xl max-w-[200px] mx-auto mb-4 border border-white/10">
                <img src={qr} alt="Mã QR xác thực" className="w-full h-auto" />
              </div>
            )}
            <input
              className="w-full rounded-xl bg-surface-container-lowest border border-outline-variant p-3 text-center font-mono tracking-widest text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder={stage === "recovery" ? "XXXXX-XXXXX" : "000000"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 p-3 text-sm font-bold text-slate-950 transition-all">
              Xác minh
            </button>
            {stage !== "enroll" && (
              <button
                type="button"
                onClick={() => setStage(stage === "recovery" ? "totp" : "recovery")}
                className="w-full text-xs text-on-surface-variant hover:text-on-surface transition-all pt-2"
              >
                {stage === "recovery" ? "Sử dụng ứng dụng xác thực" : "Sử dụng mã khôi phục dự phòng"}
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
