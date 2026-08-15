import { superAdminRequest } from "../../services/superAdminRequest";
import { getApiErrorMessage } from "../../utils/errorMessage";
import React from "react";
import { EnvironmentBanner } from "../../components/super-admin/EnvironmentBanner";
import { superAdminAuthService } from "../../services/superAdminAuthService";
import { DashboardTab } from "../../components/super-admin/DashboardTab";
import { AuditTab } from "../../components/super-admin/AuditTab";
import { SessionsTab } from "../../components/super-admin/SessionsTab";
import { TenantListPage } from "./tenants/TenantListPage";
import { TenantDetailPage } from "./tenants/TenantDetailPage";
import { UserManagementPanel } from "./users/UserManagementPanel";
import { SuperAdminAccountsPage } from "./admins/SuperAdminAccountsPage";
import { LayoutDashboard, FileText, Monitor, LogOut, UsersRound, Building2, Menu, X, ShieldCheck } from "lucide-react";
import {
  clearPendingSuperAdminChallenge,
  savePendingSuperAdminChallenge,
} from "../../services/pendingSuperAdminChallenge";

export default function SuperAdminShell() {
  const [pendingChallenge] = React.useState(() => null);
  const [stage, setStage] = React.useState<"password" | "enroll" | "totp" | "recovery" | "authenticated">(
    localStorage.getItem("accessToken") ? "authenticated" : "password"
  );
  
  const [activeTab, setActiveTab] = React.useState<"overview" | "audit" | "sessions" | "tenants" | "users" | "admins">("overview");
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
  const enrollmentHydrated = React.useRef(false);

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
      case "overview":
      default:
        return <DashboardTab />;
    }
  };

  const navItems = [
    { id: "overview" as const, label: "Tổng quan hệ thống", icon: LayoutDashboard },
    { id: "audit" as const, label: "Nhật ký kiểm toán", icon: FileText },
    { id: "users" as const, label: "Quản trị tài khoản", icon: UsersRound },
    { id: "admins" as const, label: "Tài khoản Super Admin", icon: ShieldCheck },
    { id: "tenants" as const, label: "Quản lý doanh nghiệp", icon: Building2 },
    { id: "sessions" as const, label: "Quản lý phiên làm việc", icon: Monitor },
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
          <h1 className="text-xl font-black text-white tracking-wider">BẢNG ĐIỀU KHIỂN</h1>
          <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Không gian Quản trị Tối cao
          </p>
        </div>
        <nav className="mt-6 block space-y-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === id
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-xs shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent mt-4"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Đăng xuất
      </button>
    </div>
  );

  if (stage === "authenticated") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <EnvironmentBanner environment={environment} />

        {/* Mobile Top Navigation Bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/95 backdrop-blur-xl px-4 py-3">
          <div>
            <span className="text-sm font-black text-white tracking-wider">BẢNG ĐIỀU KHIỂN</span>
            <span className="ml-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">
              Quản trị Tối cao
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 transition-all"
            aria-label="Mở menu điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile Slide-over Drawer Backdrop */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Slide-over Drawer */}
        <aside
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-white/10 p-5 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-black text-white tracking-wider">BẢNG ĐIỀU KHIỂN</h1>
              <p className="mt-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Quản trị Tối cao
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-white transition-all"
              aria-label="Đóng menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <NavContent />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950 p-6">
            <NavContent />
          </aside>

          {/* Main workspace */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 p-3 sm:p-6 lg:p-8">
            {renderActiveTab()}
          </main>
        </div>
      </div>
    );
  }


  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <p className="text-xs font-bold tracking-[.3em] text-cyan-400 uppercase">Quản trị Tối cao iGen</p>
        <h1 className="mt-3 text-2xl font-black">Đăng nhập đặc quyền</h1>
        
        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {stage === "password" ? (
          <form onSubmit={submitPassword} className="mt-8 space-y-4">
            <input
              className="w-full rounded-xl bg-slate-800 border border-white/5 p-3 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-xl bg-slate-800 border border-white/5 p-3 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
            <p className="text-amber-300 text-sm">
              Lưu các mã khôi phục này ngay. Chúng chỉ hiển thị một lần duy nhất.
            </p>
            <pre className="rounded-xl bg-black/40 border border-white/5 p-4 text-sm font-mono text-slate-300 leading-relaxed">
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
              className="w-full rounded-xl bg-slate-800 border border-white/5 p-3 text-center font-mono tracking-widest text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
                className="w-full text-xs text-slate-400 hover:text-white transition-all pt-2"
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
