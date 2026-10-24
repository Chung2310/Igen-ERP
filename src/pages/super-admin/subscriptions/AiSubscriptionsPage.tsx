import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Sparkles } from "lucide-react";
import { aiSubscriptionAdminService as api, type AiSubscriptionPlan, type AiSubscriptionSummary } from "../../../services/aiSubscriptionService";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";

const field = "mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 disabled:opacity-50";
const button = "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";
const empty = { code: "", name: "", description: "", durationDays: "30", aiLimit: "", active: true, reason: "" };
const message = (error: unknown) => error instanceof Error ? error.message : "Không thể hoàn tất thao tác.";
const date = (value: string) => new Date(value).toLocaleString("vi-VN");

export default function AiSubscriptionsPage() {
  const [plans, setPlans] = useState<AiSubscriptionPlan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editing, setEditing] = useState<AiSubscriptionPlan | null>(null);
  const [form, setForm] = useState(empty);
  const [company, setCompany] = useState("");
  const [planId, setPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [subscription, setSubscription] = useState<AiSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [grantLoading, setGrantLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grantBusy, setGrantBusy] = useState(false);
  const [error, setError] = useState("");
  const [grantError, setGrantError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([api.plans(), superAdminTenantService.list()]).then(([items, companies]) => {
      if (active) { setPlans(items); setTenants(companies); }
    }).catch((cause) => { if (active) setError(message(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!company) return;
    let active = true;
    void api.current(company).then((value) => { if (active) setSubscription(value); })
      .catch((cause) => { if (active) setGrantError(message(cause)); }).finally(() => { if (active) setGrantLoading(false); });
    return () => { active = false; };
  }, [company]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api.save({ ...form, durationDays: Number(form.durationDays), aiLimit: Number(form.aiLimit), updatedAt: editing?.updatedAt }, editing?._id);
      setPlans(await api.plans()); setEditing(null); setForm(empty);
    } catch (cause) { setError(message(cause)); } finally { setSaving(false); }
  };
  const grant = async (cancel = false) => {
    setGrantBusy(true); setGrantError("");
    try {
      if (cancel) await api.cancel(company, reason); else await api.assign(company, planId, reason);
      setSubscription(await api.current(company)); setReason("");
    } catch (cause) { setGrantError(message(cause)); } finally { setGrantBusy(false); }
  };
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="h-5 w-5 text-cyan-400" />Gói AI & Subscription</h2>
        <p className="mt-2 text-sm text-slate-400">Hạn mức dùng chung cho doanh nghiệp. Mỗi lần gọi AI thành công tính 1 lượt.</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h3 className="text-base font-semibold">{editing ? "Chỉnh sửa gói AI" : "Tạo gói AI"}</h3>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">Mã gói<input required maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={field} /></label>
              <label className="text-sm text-slate-300">Tên gói<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} /></label>
              <label className="text-sm text-slate-300">Thời hạn (ngày)<input type="number" required min={1} max={3660} step={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className={field} /></label>
              <label className="text-sm text-slate-300">Số lượt AI trong gói<input type="number" required min={1} max={10000000} step={1} value={form.aiLimit} onChange={(e) => setForm({ ...form, aiLimit: e.target.value })} placeholder="Nhập hạn mức" className={field} /></label>
            </div>
            <label className="block text-sm text-slate-300">Mô tả<textarea maxLength={1000} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} /></label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Cho phép cấp gói mới</label>
            <label className="block text-sm text-slate-300">Lý do thay đổi<input required minLength={3} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={field} /></label>
            <p className="text-xs leading-relaxed text-slate-400">Thay đổi gói áp dụng cho lần cấp tiếp theo. Kỳ đang sử dụng giữ hạn mức đã được cấp.</p>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex gap-2"><button disabled={saving || loading} className={button}>{saving ? "Đang lưu..." : "Lưu gói"}</button>
              {editing && <button type="button" disabled={saving} onClick={() => { setEditing(null); setForm(empty); }} className="px-3 text-sm text-slate-300">Hủy chỉnh sửa</button>}
            </div>
          </form>
        </section>
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h3 className="text-base font-semibold">Cấp gói cho doanh nghiệp</h3>
          <label className="block text-sm text-slate-300">Doanh nghiệp<select value={company} disabled={grantBusy} onChange={(e) => { setCompany(e.target.value); setGrantLoading(Boolean(e.target.value)); setSubscription(null); setGrantError(""); }} className={field}><option value="">Chọn doanh nghiệp</option>{tenants.map((tenant) => <option key={tenant.code} value={tenant.code}>{tenant.name || tenant.code} · {tenant.code}</option>)}</select></label>
          {grantLoading ? <p className="text-sm text-slate-400">Đang tải gói hiện tại...</p> : subscription ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-800 p-4 text-sm">
              <p className="font-semibold text-cyan-300">{subscription.planName} · {subscription.status === "active" ? "Đang hiệu lực" : "Đã hết hạn"}</p>
              <p>Đã dùng {subscription.used.toLocaleString("vi-VN")} / {subscription.aiLimit.toLocaleString("vi-VN")} lượt</p>
              <p className="text-slate-400">Đang giữ: {subscription.reserved} · Còn lại: {subscription.remaining}</p>
              <p className="text-xs text-slate-400">{date(subscription.startsAt)} → {date(subscription.expiresAt)}</p>
            </div>
          ) : company && !grantError ? <p className="text-sm text-slate-400">Doanh nghiệp chưa có gói AI.</p> : null}
          <label className="block text-sm text-slate-300">Gói cần cấp<select value={planId} disabled={grantBusy} onChange={(e) => setPlanId(e.target.value)} className={field}><option value="">Chọn gói</option>{plans.filter((item) => item.active).map((item) => <option key={item._id} value={item._id}>{item.name} · {item.aiLimit.toLocaleString("vi-VN")} lượt / {item.durationDays} ngày</option>)}</select></label>
          <label className="block text-sm text-slate-300">Lý do cấp hoặc thu hồi<input minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>
          <p className="text-xs leading-relaxed text-amber-200/80">Cấp gói bắt đầu kỳ mới ngay, thay kỳ hiện tại và không cộng dồn lượt dư. Thu hồi sẽ dừng các yêu cầu AI mới.</p>
          {grantError && <p role="alert" className="text-sm text-red-300">{grantError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!company || !planId || reason.trim().length < 3 || grantBusy || grantLoading} onClick={() => void grant()} className={button}><Plus className="h-4 w-4" />{grantBusy ? "Đang xử lý..." : "Bắt đầu kỳ mới"}</button>
            {subscription && <button type="button" disabled={reason.trim().length < 3 || grantBusy || grantLoading} onClick={() => void grant(true)} className="rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-300 disabled:opacity-50">Thu hồi gói</button>}
          </div>
        </section>
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <header className="flex items-center justify-between gap-3 p-5"><h3 className="font-semibold">Danh sách gói AI</h3><button type="button" aria-label="Tải lại gói AI" onClick={() => { void api.plans().then(setPlans).catch((cause) => setError(message(cause))); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><RefreshCw className="h-4 w-4" /></button></header>
        {loading ? <p className="px-5 pb-5 text-sm text-slate-400">Đang tải...</p> : !plans.length ? <p className="px-5 pb-5 text-sm text-slate-400">Chưa có gói. Tạo gói và đặt số lượt AI ở biểu mẫu phía trên.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-800 text-xs text-slate-400"><tr><th className="px-5 py-3">Gói</th><th className="px-4 py-3">Số lượt AI</th><th className="px-4 py-3">Thời hạn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"><span className="sr-only">Thao tác</span></th></tr></thead><tbody className="divide-y divide-white/5">{plans.map((item) => <tr key={item._id}><td className="px-5 py-4"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.code}</p></td><td className="px-4 py-4">{item.aiLimit.toLocaleString("vi-VN")}</td><td className="px-4 py-4">{item.durationDays} ngày</td><td className="px-4 py-4 text-xs text-slate-400">{item.active ? "Đang cung cấp" : "Ngừng cấp mới"}</td><td className="px-4 py-4"><button type="button" disabled={saving} onClick={() => { setEditing(item); setForm({ code: item.code, name: item.name, description: item.description, active: item.active, durationDays: String(item.durationDays), aiLimit: String(item.aiLimit), reason: "" }); }} className="inline-flex items-center gap-1.5 text-cyan-300"><Pencil className="h-4 w-4" />Sửa</button></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  );
}
