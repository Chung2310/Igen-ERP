import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, RefreshCw, ArrowRight, Eye, EyeOff } from "lucide-react";
import { BRAND_LOGO_URL, BRAND_NAME } from "../config/brand";

export default function AuthPage() {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password.trim(), rememberMe);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f8fd] via-[#eef2f7] to-[#e3ecf5] p-4 overflow-hidden relative font-sans">
      
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none" />

      {/* Main Login Card Container */}
      <div className="w-full max-w-md bg-white/85 backdrop-blur-2xl border border-slate-100/90 rounded-3xl p-9 shadow-[0_22px_70px_rgba(15,23,42,0.06)] z-10 flex flex-col gap-6 text-left animate-fade-in-up">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-block relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur-sm animate-pulse" />
            <img
              src={BRAND_LOGO_URL}
              alt={BRAND_NAME}
              className="relative mx-auto h-16 w-16 rounded-2xl border border-white object-cover shadow-lg"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Hệ thống Quản trị {BRAND_NAME}</h2>
            <p className="text-xs text-slate-400">Đăng nhập tài khoản doanh nghiệp để bắt đầu</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Địa chỉ Email *</label>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="email" 
                required
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Mật khẩu *</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
      </div>
    </div>
  );
}
