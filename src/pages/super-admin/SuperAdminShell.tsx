import React from "react";
import { EnvironmentBanner } from "../../components/super-admin/EnvironmentBanner";
import { superAdminAuthService } from "../../services/superAdminAuthService";
import { DashboardTab } from "../../components/super-admin/DashboardTab";
import { AuditTab } from "../../components/super-admin/AuditTab";
import { SessionsTab } from "../../components/super-admin/SessionsTab";
import { TenantListPage } from "./tenants/TenantListPage";
import { UserSearchPage } from "./users/UserSearchPage";
import { LayoutDashboard, FileText, Monitor, LogOut, UsersRound, Building2 } from "lucide-react";

export default function SuperAdminShell() {
  const [stage, setStage] = React.useState<"password" | "enroll" | "totp" | "recovery" | "authenticated">(
    localStorage.getItem("accessToken") ? "authenticated" : "password"
  );
  
  const [activeTab, setActiveTab] = React.useState<"overview" | "audit" | "sessions" | "tenants" | "users">("overview");
  const [challenge, setChallenge] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [environment, setEnvironment] = React.useState<"staging" | "production">("staging");
  const [error, setError] = React.useState("");

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
      if (r.status !== "challenge_required") {
        throw new Error("Tài khoản không yêu cầu xác thực quản trị viên tối cao");
      }
      setChallenge(r.challengeId);
      if (r.enrollmentRequired) {
        const enrollment = await superAdminAuthService.startEnrollment(r.challengeId);
        setQr(enrollment.qrDataUrl);
        setStage("enroll");
      } else {
        setStage("totp");
      }
    } catch (e: any) {
      setError(e.message || "Đăng nhập thất bại");
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

      if (r.recoveryCodes) {
        setRecoveryCodes(r.recoveryCodes);
        return;
      }
      setQr("");
      setCode("");
      setStage("authenticated");
    } catch (e: any) {
      setError(e.message || "Xác minh thất bại");
    }
  };

  const handleLogout = async () => {
    try {
      // call logout endpoint if needed
      await fetch("/api/v1/super-admin/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      }).catch(() => {});
    } finally {
      localStorage.removeItem("accessToken");
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
        return <TenantListPage onSelect={() => undefined} />;
      case "users":
        return <UserSearchPage tenantId="SYSTEM" onSelect={() => undefined} />;
      case "overview":
      default:
        return <DashboardTab />;
    }
  };

  if (stage === "authenticated") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <EnvironmentBanner environment={environment} />
        
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 border-b border-white/10 bg-slate-950 p-4 sm:p-6 lg:w-64 lg:border-b-0 lg:border-r">
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-black text-white tracking-wider">BẢNG ĐIỀU KHIỂN</h1>
                <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Không gian Quản trị Tối cao
                </p>
              </div>

              <nav className="mt-6 flex flex-wrap gap-2 lg:mt-8 lg:block lg:space-y-2">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === "overview"
                      ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Tổng quan hệ thống
                </button>

                <button
                  onClick={() => setActiveTab("audit")}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === "audit"
                      ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Nhật ký kiểm toán
                </button>

                <button
                  onClick={() => setActiveTab("users")}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === "users"
                      ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <UsersRound className="h-4 w-4" />
                  Quản trị tài khoản
                </button>
                <button
                  onClick={() => setActiveTab("tenants")}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === "tenants"
                      ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Quản lý doanh nghiệp
                </button>
                <button
                  onClick={() => setActiveTab("sessions")}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === "sessions"
                      ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  Quản lý phiên làm việc
                </button>
              </nav>
            </div>

            {/* Logout button in sidebar footer */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </aside>

          {/* Main workspace */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
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
