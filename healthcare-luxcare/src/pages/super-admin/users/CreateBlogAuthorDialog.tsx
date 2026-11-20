import React from "react";
import { Sparkles, Globe, ShieldCheck } from "lucide-react";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import { superAdminRequest } from "../../../services/superAdminRequest";

export function CreateBlogAuthorDialog({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  // Mặc định "SYSTEM" - Không thuộc công ty nào (Toàn hệ thống độc lập)
  const [companyCode, setCompanyCode] = React.useState(tenantId === "SYSTEM" ? "SYSTEM" : tenantId);
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    superAdminTenantService
      .list()
      .then((items) => {
        if (!cancelled) setTenants(items.filter((item) => item.code !== "SYSTEM"));
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message || "Không thể tải danh sách doanh nghiệp.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const finalCompanyCode = companyCode || "SYSTEM";
      await superAdminRequest("/api/v1/auth/register-user", {
        method: "POST",
        body: JSON.stringify({
          companyCode: finalCompanyCode,
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          role: "blog_editor",
        }),
        successMessage: "Đã tạo tài khoản Ban Biên Tập Blog thành công.",
        suppressErrorToast: true,
      });
      setPassword("");
      onCreated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo tài khoản Ban Biên Tập Blog.");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400";

  const isGlobalSystem = !companyCode || companyCode === "SYSTEM";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-blog-author-title"
        className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-slate-100 shadow-2xl shadow-amber-500/10"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 id="create-blog-author-title" className="text-lg font-bold text-white">
              Tạo Ban Biên Tập Blog (Tác giả Độc lập)
            </h3>
            <p className="text-xs text-slate-400">
              Cấp tài khoản có quyền đặc biệt đăng bài vào Kênh Tin Tức / Blog
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              Tài khoản này mang vai trò <strong className="font-semibold text-white">Ban biên tập (`blog_editor`)</strong> độc lập, <strong className="text-amber-300">không bắt buộc nằm trong công ty nào</strong>. Khi đăng bài, thông tin sẽ được truyền thông toàn hệ thống tới tất cả người dùng.
            </span>
          </div>
        </div>

        <label className="block text-sm">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Globe className="h-3.5 w-3.5 text-amber-400" />
            Phạm vi hoạt động (Doanh nghiệp)
          </span>
          <select
            value={companyCode}
            onChange={(event) => setCompanyCode(event.target.value)}
            disabled={saving || (tenantId !== "SYSTEM" && tenantId !== "")}
            className={fieldClass}
          >
            <option value="SYSTEM">🌐 Không thuộc công ty nào (Toàn hệ thống - Khuyên dùng)</option>
            {tenants.map((tenant) => (
              <option key={tenant.code} value={tenant.code}>
                🏢 Chỉ riêng: {tenant.name || tenant.code} ({tenant.code})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-slate-400">
            {isGlobalSystem
              ? "Tài khoản độc lập cấp hệ thống, đăng tin tức phát sóng tới mọi công ty."
              : `Tài khoản sẽ được gắn trực thuộc công ty ${companyCode}.`}
          </span>
        </label>

        <label className="block text-sm">
          Họ và tên tác giả
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={saving}
            placeholder="Ví dụ: Ban Biên Tập Hệ Thống"
            className={fieldClass}
            autoComplete="name"
          />
        </label>

        <label className="block text-sm">
          Email đăng nhập
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={saving}
            placeholder="editor@luxcare.vn"
            className={fieldClass}
            autoComplete="off"
          />
        </label>

        <label className="block text-sm">
          Mật khẩu khởi tạo
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={saving}
            placeholder="Tối thiểu 6 ký tự"
            className={fieldClass}
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !displayName.trim() || !password}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Đang tạo..." : "Tạo Ban Biên Tập Độc Lập"}
          </button>
        </div>
      </form>
    </div>
  );
}
