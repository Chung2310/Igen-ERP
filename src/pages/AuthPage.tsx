import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Mail, Lock, User, RefreshCw, ArrowRight } from "lucide-react";
import { BRAND_LOGO_URL, BRAND_NAME } from "../config/brand";

type AuthMode = "login" | "register";
const AUTH_MODE_STORAGE_KEY = "igenerp-auth-mode";

const getInitialAuthMode = (): AuthMode => {
  if (typeof window === "undefined") return "login";
  const savedMode = window.localStorage.getItem(AUTH_MODE_STORAGE_KEY);
  return savedMode === "register" ? "register" : "login";
};

export default function AuthPage() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const { dark } = useTheme();

  const isLogin = authMode === "login";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_MODE_STORAGE_KEY, authMode);
    }
  }, [authMode]);

  const setMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setFormError("");
    if (mode === "login") {
      setDisplayName("");
    }
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "Đã có lỗi xảy ra. Vui lòng thử lại sau.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!email.trim() || !password.trim()) {
      setFormError("Vui lòng nhập email và mật khẩu.");
      return;
    }

    if (!isLogin && !displayName.trim()) {
      setFormError("Vui lòng nhập họ và tên để đăng ký.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email.trim(), password.trim(), rememberMe);
      } else {
        await registerWithEmail(email.trim(), password.trim(), displayName.trim(), rememberMe);
      }
    } catch (error) {
      setFormError(getErrorMessage(error));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading || loading) return;

    setFormError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle(rememberMe);
    } catch (error) {
      setFormError(getErrorMessage(error));
      console.error(error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const authCardClass = dark ? "bg-slate-900/90 border border-slate-700/50" : "bg-white border border-slate-200 shadow-xl";
  const authInputClass = dark
    ? "w-full pl-11 pr-4 py-3 bg-slate-850/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-550 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
    : "w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-950 placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none";
  const authLabelClass = dark
    ? "text-[10px] font-bold text-slate-400 uppercase tracking-wider block"
    : "text-[10px] font-bold text-slate-500 uppercase tracking-wider block";
  const authIconClass = dark ? "absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" : "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400";
  const authCheckboxClass = dark
    ? "rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
    : "rounded border-slate-300 bg-white text-cyan-600 focus:ring-cyan-500 h-4 w-4";

  // Class dùng chung cho trạng thái nút màu xanh ngọc active
  const activeGreenButtonClass = "bg-[#00b2cb] text-white hover:bg-[#009cb2] shadow-md shadow-cyan-500/10";

  return (
    <div className={`min-h-screen w-screen flex items-center justify-center px-4 py-10 overflow-hidden relative font-sans ${dark ? "bg-black text-slate-100" : "bg-white text-slate-950"}`}>
      <div className={`absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full ${dark ? "bg-blue-500/10" : "bg-sky-300/20"} blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full ${dark ? "bg-purple-500/10" : "bg-fuchsia-300/15"} blur-[120px] pointer-events-none`} />



      <div className={`w-full max-w-md rounded-3xl p-8 shadow-2xl z-10 flex flex-col gap-6 text-left ${authCardClass}`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <img
            src={BRAND_LOGO_URL}
            alt={BRAND_NAME}
            className={`h-14 w-14 rounded-2xl border ${dark ? "border-white/10 shadow-slate-950/30" : "border-slate-200 shadow-slate-300/30"} object-cover shadow-lg`}
          />
          <div className="space-y-2">
            <h2 className={`text-2xl font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>Hệ thống Quản trị {BRAND_NAME}</h2>
            <p className={`${dark ? "text-slate-400" : "text-slate-500"} text-xs`}>Đăng nhập tài khoản doanh nghiệp để bắt đầu</p>
          </div>
        </div>



        {formError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {formError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className={authLabelClass}>Họ và Tên *</label>
              <div className="relative">
                <User className={authIconClass} />
                <input
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={authInputClass}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={authLabelClass}>Địa chỉ Email *</label>
            <div className="relative">
              <Mail className={authIconClass} />
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={authLabelClass}>Mật khẩu *</label>
            <div className="relative">
              <Lock className={authIconClass} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs select-none pt-1">
            <label className={`flex items-center gap-2 ${dark ? "text-slate-300" : "text-slate-600"} cursor-pointer`}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={authCheckboxClass}
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 py-3.5 text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 ${activeGreenButtonClass}`}
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span>Đăng nhập hệ thống</span>
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>
      </div>
    </div>
  );
}