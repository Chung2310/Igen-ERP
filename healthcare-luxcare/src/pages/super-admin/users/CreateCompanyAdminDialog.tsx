import React from "react";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import { superAdminRequest } from "../../../services/superAdminRequest";

export function CreateCompanyAdminDialog({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [companyCode, setCompanyCode] = React.useState(tenantId === "SYSTEM" ? "" : tenantId);
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
        if (!cancelled) setError(failure.message || "Không thể tải doanh nghiệp.");
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
    if (saving || !tenants.some((tenant) => tenant.code === companyCode)) return;
    setSaving(true);
    setError("");
    try {
      await superAdminRequest("/api/v1/auth/register-user", {
        method: "POST",
        body: JSON.stringify({
          companyCode,
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          role: "admin",
        }),
        successMessage: "Đã tạo quản trị viên doanh nghiệp.",
        suppressErrorToast: true,
      });
      setPassword("");
      onCreated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo quản trị viên.");
    } finally {
      setSaving(false);
    }
  };
  const fieldClass = "mt-1 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-slate-100";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-company-admin-title"
        className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-100"
      >
        <h3 id="create-company-admin-title" className="text-lg font-bold">
          Tạo quản trị viên doanh nghiệp
        </h3>
        <label className="block text-sm">
          Doanh nghiệp
          <select
            required
            value={companyCode}
            onChange={(event) => setCompanyCode(event.target.value)}
            disabled={loading || saving || tenantId !== "SYSTEM"}
            className={fieldClass}
          >
            <option value="">{loading ? "Đang tải doanh nghiệp..." : "Chọn doanh nghiệp"}</option>
            {tenants.map((tenant) => (
              <option key={tenant.code} value={tenant.code}>
                {tenant.name || tenant.code} ({tenant.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Họ và tên
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={saving}
            className={fieldClass}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={saving}
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
            className={fieldClass}
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/20 px-4 py-2"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || loading || !companyCode || !displayName.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Đang tạo..." : "Tạo quản trị viên"}
          </button>
        </div>
      </form>
    </div>
  );
}
