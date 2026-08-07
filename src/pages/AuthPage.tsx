import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, RefreshCw, ArrowRight, Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import {
  BRAND_LOGO_PATH,
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  USER_DATA_DELETION_URL,
} from "../config/brand";
import { parseFirebaseError } from "../utils/firebaseErrorParser";

export default function AuthPage() {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Error states for local validation & server responses
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validateForm = () => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setError(null);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email không được để trống.");
      isValid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError("Địa chỉ email không đúng định dạng.");
      isValid = false;
    }

    // Validate password
    if (!password) {
      setPasswordError("Mật khẩu không được để trống.");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Mật khẩu phải chứa ít nhất 6 ký tự.");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await loginWithEmail(email.trim(), password.trim(), rememberMe);
      if (result.role === "superadmin") {
        window.location.href = "/super-admin";
        return;
      }
    } catch (err: any) {
      console.error(err);
      const msg = parseFirebaseError(err, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] p-4 py-8 overflow-y-auto relative font-sans">
      
      {/* Background Decorative Blobs */}
      <div className="pointer-events-none absolute left-[-20%] top-[-8%] h-[360px] w-[360px] rounded-full bg-blue-400/10 blur-[90px] sm:left-[-10%] sm:top-[-10%] sm:h-[600px] sm:w-[600px] sm:blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8%] right-[-20%] h-[360px] w-[360px] rounded-full bg-indigo-400/10 blur-[90px] sm:bottom-[-10%] sm:right-[-10%] sm:h-[600px] sm:w-[600px] sm:blur-[120px]" />

      {/* Main Login Card Container */}
      <div className="z-10 flex w-full max-w-md flex-col gap-5 rounded-3xl border border-slate-100/90 bg-white/85 p-5 text-left shadow-[0_22px_70px_rgba(15,23,42,0.06)] backdrop-blur-2xl animate-fade-in-up sm:gap-6 sm:p-9">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về trang chủ</span>
          </a>
        </div>
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-block relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-sm animate-pulse" />
            <img
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              className="relative mx-auto h-16 w-16 rounded-2xl border border-white object-cover shadow-lg"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Hệ thống Quản trị {BRAND_NAME}</h2>
            <p className="text-xs text-slate-400">Đăng nhập tài khoản doanh nghiệp để bắt đầu</p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs flex items-center gap-2.5 animate-fade-in-up">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Địa chỉ Email *</label>
            <div className="relative group">
              <Mail className={`absolute left-3.5 top-3.5 h-4 w-4 transition-colors ${
                emailError ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-600"
              }`} />
              <input 
                type="email" 
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (error) setError(null);
                }}
                className={`w-full pl-11 pr-4 py-3 bg-slate-50 border rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white outline-none transition-all duration-200 ${
                  emailError 
                    ? "border-red-300 focus:ring-4 focus:ring-red-500/10 focus:border-red-500" 
                    : "border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                }`}
              />
            </div>
            {emailError && (
              <span className="text-[10px] text-red-500 font-bold mt-1 block pl-1 animate-fade-in-up">
                {emailError}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Mật khẩu *</label>
            <div className="relative group">
              <Lock className={`absolute left-3.5 top-3.5 h-4 w-4 transition-colors ${
                passwordError ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-600"
              }`} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (error) setError(null);
                }}
                className={`w-full pl-11 pr-11 py-3 bg-slate-50 border rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white outline-none transition-all duration-200 ${
                  passwordError 
                    ? "border-red-300 focus:ring-4 focus:ring-red-500/10 focus:border-red-500" 
                    : "border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError && (
              <span className="text-[10px] text-red-500 font-bold mt-1 block pl-1 animate-fade-in-up">
                {passwordError}
              </span>
            )}
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center justify-between text-xs select-none pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                className="rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer duration-200"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span>Đăng nhập hệ thống</span>
          </button>
        </form>
        <div className="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-600 underline underline-offset-2 hover:text-blue-700"
            >
              Privacy Policy
            </a>
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-600 underline underline-offset-2 hover:text-blue-700"
            >
              Terms of Service
            </a>
            <a
              href={USER_DATA_DELETION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-600 underline underline-offset-2 hover:text-blue-700"
            >
              Data Deletion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
