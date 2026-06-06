import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, User, RefreshCw, ArrowRight } from "lucide-react";
import { BRAND_LOGO_URL, BRAND_NAME } from "../config/brand";

export default function AuthPage() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email.trim(), password.trim(), rememberMe);
      } else {
        if (!displayName.trim()) {
          setLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password.trim(), displayName.trim(), rememberMe);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading || loading) return; // tránh double-click
    setGoogleLoading(true);
    try {
      await loginWithGoogle(rememberMe);
    } catch {
      // AuthContext đã xử lý toast + log cho lỗi thực sự
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-screen w-screen h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 overflow-hidden relative font-sans">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-700/40 rounded-3xl p-8 shadow-2xl z-10 flex flex-col gap-6 text-left">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <img
            src={BRAND_LOGO_URL}
            alt={BRAND_NAME}
            className="mx-auto h-14 w-14 rounded-2xl border border-white/10 object-cover shadow-lg shadow-slate-950/30"
          />
          <h2 className="text-2xl font-bold text-white tracking-tight">Hệ thống Quản trị {BRAND_NAME}</h2>
          <p className="text-xs text-slate-400">Đăng nhập tài khoản doanh nghiệp để bắt đầu</p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/30 select-none">
          <button 
            type="button"
            onClick={() => {
              setIsLogin(true);
              setDisplayName("");
            }}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold transition-all ${
              isLogin 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ĐĂNG NHẬP
          </button>
          <button 
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold transition-all ${
              !isLogin 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ĐĂNG KÝ
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Họ và Tên *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input 
                  type="text" 
                  required
                  placeholder="Nguyễn Văn A" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-850/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-550 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Địa chỉ Email *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="email" 
                required
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-850/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-550 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mật khẩu *</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-850/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-550 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center justify-between text-xs select-none pt-1">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span>{isLogin ? "Đăng nhập hệ thống" : "Đăng ký thành viên"}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hoặc tiếp tục với</span>
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>

        {/* Third-party Login */}
        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full py-3 bg-white hover:bg-slate-100 disabled:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
        >
          {googleLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>{googleLoading ? "Đang mở Google..." : "Đăng nhập bằng Google"}</span>
        </button>

      </div>
    </div>
  );
}
