import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  BRAND_FULL_LOGO_PATH,
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "../config/brand";
import { parseFirebaseError } from "../utils/firebaseErrorParser";

export default function AuthPage() {
  const { loginWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validateForm = () => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email không được để trống.");
      isValid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError("Địa chỉ email không đúng định dạng.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Mật khẩu không được để trống.");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Mật khẩu phải chứa ít nhất 6 ký tự.");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await loginWithEmail(email.trim(), password.trim(), rememberMe);
      if (result.role === "superadmin") {
        window.location.href = "/super-admin";
        return;
      }
    } catch (caught: unknown) {
      setError(parseFirebaseError(caught, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0b1a30] bg-cover bg-center px-4 py-5 font-sans sm:px-8"
      style={{ backgroundImage: "url('/login-business-background.png')" }}
    >
      <div className="absolute inset-0 bg-[#06172b]/50" aria-hidden="true" />

      <div className="relative z-10 grid w-full max-w-[900px] overflow-hidden rounded-[20px] bg-white shadow-[0_32px_90px_rgba(0,12,34,0.38)] lg:min-h-[500px] lg:grid-cols-[0.98fr_1.02fr]">
        <section className="relative isolate flex min-h-[260px] flex-col overflow-hidden bg-gradient-to-br from-[#0497f5] via-[#0577e7] to-[#064fc4] px-7 py-7 text-white sm:px-9 lg:min-h-[500px] lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border border-white/20 bg-cyan-300/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full border border-white/15 bg-blue-950/10" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_bottom,transparent,black)]" aria-hidden="true" />

          <div className="relative flex items-center gap-2.5 text-sm font-semibold tracking-wide">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/45 bg-[#0758b8]/75 text-[#9cf3ff] shadow-[0_4px_12px_rgba(0,45,115,0.18)]">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            Nền tảng quản trị doanh nghiệp
          </div>

          <div className="relative mt-7 lg:mt-9">
            <h1 className="text-center font-semibold uppercase leading-[1.2] tracking-[0.01em]" style={{ textShadow: "0 2px 0 rgba(0,48,135,0.75), 0 5px 12px rgba(0,31,97,0.45)" }}>
              <span className="block text-[20px] sm:text-[21px] lg:whitespace-nowrap">Điều hành doanh nghiệp</span>
              <span className="block text-[20px] sm:text-[21px] lg:whitespace-nowrap">trong một hệ thống</span>
            </h1>

          </div>

          <div className="relative flex flex-1 items-center justify-center pt-4">
            <img
              src="/login-igen-operator.png"
              alt="Robot iGen đang điều hành hệ thống qua bảng điều khiển và các biểu đồ"
              width={1422}
              height={1106}
              className="h-48 w-full max-w-[360px] object-contain drop-shadow-[0_16px_24px_rgba(0,35,110,0.25)] lg:h-[280px]"
            />
          </div>
        </section>

        <section className="flex flex-col bg-white px-7 py-8 sm:px-10 lg:px-10 lg:py-8">
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
            <img
              src={BRAND_FULL_LOGO_PATH}
              alt={BRAND_NAME}
              className="mx-auto h-[76px] w-[215px] object-contain"
            />
            <div className="mt-3 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-800">Đăng nhập</h2>
              <p className="mt-1.5 text-[13px] text-slate-500">Chào mừng bạn quay lại {BRAND_NAME}</p>
            </div>

            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3.5">
              <div>
                <label htmlFor="login-email" className="sr-only">Địa chỉ email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Địa chỉ email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) setEmailError(null);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "login-email-error" : undefined}
                  className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/15 ${emailError ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"}`}
                />
                {emailError && <p id="login-email-error" className="mt-1.5 text-xs text-red-600">{emailError}</p>}
              </div>

              <div>
                <label htmlFor="login-password" className="sr-only">Mật khẩu</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (passwordError) setPasswordError(null);
                      if (error) setError(null);
                    }}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? "login-password-error" : undefined}
                    className={`h-11 w-full rounded-lg border bg-white px-4 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/15 ${passwordError ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-blue-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
                {passwordError && <p id="login-password-error" className="mt-1.5 text-xs text-red-600">{passwordError}</p>}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                Ghi nhớ đăng nhập
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0667ef] text-sm font-semibold text-white shadow-sm transition hover:bg-[#0559d2] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                Đăng nhập
              </button>
              <p className="text-center text-[11px] font-medium text-slate-400">Version 2.0</p>
            </form>

            <a href="/" className="mt-5 inline-flex items-center justify-center gap-2 text-[13px] font-medium text-blue-600 transition hover:text-blue-800">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Về trang chủ
            </a>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Bảo mật</a>
            <a href={TERMS_OF_SERVICE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Điều khoản</a>
          </div>
        </section>
      </div>

      <p className="relative z-10 mt-3 text-center text-[11px] font-medium text-white/80">
        © {new Date().getFullYear()} {BRAND_NAME}. Bản quyền thuộc iGen.
      </p>
    </main>
  );
}
