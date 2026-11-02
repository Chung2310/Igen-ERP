import { useEffect, useState, type FormEvent } from "react";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "../../../config/modules";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import { servicePlanAdminService as api, type ServicePlan, type ServicePlanInput, type ServiceSubscription } from "../../../services/servicePlanAdminService";

const empty = { code: "", name: "", description: "", priceVnd: "", durationDays: "30", modules: [] as string[], active: true, reason: "" };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "Không thể thực hiện thao tác.";
const currency = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");

export default function ServicePlansPanel() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ServicePlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [company, setCompany] = useState("");
  const [current, setCurrent] = useState<ServiceSubscription | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [planId, setPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedPlan = plans.find(item => item._id === planId && item.active);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([api.plans(), superAdminTenantService.list()])
      .then(([newPlans, newTenants]) => { if (active) { setPlans(newPlans); setTenants(newTenants); } })
      .catch(cause => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (!company) return;
    let active = true;
    setCurrentLoading(true);
    void api.current(company).then(value => { if (active) setCurrent(value); })
      .catch(cause => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setCurrentLoading(false); });
    return () => { active = false; };
  }, [company, revision]);

  function edit(plan: ServicePlan | null) {
    setEditing(plan); setShowForm(true);
    setForm(plan ? { code: plan.code, name: plan.name, description: plan.description, priceVnd: String(plan.priceVnd),
      durationDays: String(plan.durationDays), modules: [...plan.modules], active: plan.active, reason: "" } : { ...empty, modules: [] });
    setError(""); setNotice("");
  }
  function toggleModule(key: string) {
    setForm(value => ({ ...value, modules: value.modules.includes(key) ? value.modules.filter(item => item !== key) : [...value.modules, key] }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || form.modules.length === 0 || form.reason.trim().length < 3) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const input: ServicePlanInput = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(),
        priceVnd: Number(form.priceVnd), durationDays: Number(form.durationDays), reason: form.reason.trim(), updatedAt: editing?.updatedAt };
      await api.save(input, editing?._id);
      setNotice(editing ? "Đã cập nhật gói dịch vụ." : "Đã tạo gói dịch vụ.");
      setEditing(null); setShowForm(false); setForm(empty); setRevision(value => value + 1);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  async function grant(cancel = false) {
    if (!company || busy || currentLoading || reason.trim().length < 3 || (!cancel && !selectedPlan) || (cancel && !current)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (cancel) await api.cancel(company, reason.trim(), current!.startsAt);
      else await api.assign(company, selectedPlan!._id, reason.trim(), current?.startsAt ?? null, selectedPlan!.updatedAt);
      setNotice(cancel ? "Đã thu hồi gói dịch vụ." : "Đã cấp gói dịch vụ cho doanh nghiệp.");
      setReason(""); setRevision(value => value + 1);
    } catch (cause) {
      setError(errorText(cause));
      setRevision(value => value + 1);
    } finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <section className="sa-ai-panel space-y-4 p-5" aria-label="Danh mục gói dịch vụ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-balance text-lg font-semibold">Gói dịch vụ doanh nghiệp</h3><p className="sa-ai-muted mt-1 text-pretty">Mỗi gói quy định phân hệ, giá và thời hạn sử dụng.</p></div>
        <button type="button" className="sa-ai-button sa-ai-button-secondary" onClick={() => edit(null)}>Tạo gói dịch vụ</button>
      </div>
      {loading ? <p role="status">Đang tải danh mục…</p> : plans.length ?
        <ul className="space-y-2">{plans.map(plan => <li key={plan._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline p-3">
          <div><strong>{plan.name}</strong><p className="sa-ai-muted">{plan.code} · {currency(plan.priceVnd)} / {plan.durationDays} ngày · {plan.modules.length} phân hệ · {plan.active ? "Đang cấp" : "Ngừng cấp"}</p></div>
          <button type="button" className="sa-ai-button sa-ai-button-secondary" onClick={() => edit(plan)}>Sửa</button>
        </li>)}</ul> : <p className="sa-ai-muted">Chưa có gói dịch vụ. Tạo gói đầu tiên để cấp cho doanh nghiệp.</p>}
      {showForm && <form onSubmit={save} className="space-y-3 rounded-lg border border-outline p-4" aria-label={editing ? "Chỉnh sửa gói dịch vụ" : "Tạo gói dịch vụ"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sa-ai-label">Tên gói<input className="sa-ai-input" required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          <label className="sa-ai-label">Mã gói<input className="sa-ai-input" required pattern="[A-Za-z0-9_-]+" maxLength={40} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></label>
          <label className="sa-ai-label">Giá (VND)<input className="sa-ai-input" type="number" min={0} max={1000000000} step={1} required value={form.priceVnd} onChange={event => setForm({ ...form, priceVnd: event.target.value })} /></label>
          <label className="sa-ai-label">Thời hạn (ngày)<input className="sa-ai-input" type="number" min={1} max={3660} step={1} required value={form.durationDays} onChange={event => setForm({ ...form, durationDays: event.target.value })} /></label>
        </div>
        <label className="sa-ai-label">Mô tả<textarea className="sa-ai-input" rows={2} maxLength={1000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
        <fieldset><legend className="sa-ai-label">Phân hệ trong gói</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MODULE_KEYS.map(key => <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.modules.includes(key)} onChange={() => toggleModule(key)} />{MODULE_LABELS[key as ModuleKey]}
          </label>)}</div>
          {form.modules.length === 0 && <p className="sa-ai-muted mt-1">Chọn ít nhất một phân hệ.</p>}
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Cho phép cấp mới</label>
        <label className="sa-ai-label">Lý do thay đổi<textarea className="sa-ai-input" rows={2} minLength={3} maxLength={500} required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
        <div className="flex gap-2"><button className="sa-ai-button sa-ai-button-primary" disabled={busy || !form.modules.length || form.reason.trim().length < 3}>Lưu gói</button>
          <button type="button" className="sa-ai-button sa-ai-button-secondary" onClick={() => { setEditing(null); setShowForm(false); setForm(empty); }}>Đóng</button></div>
      </form>}
    </section>
    <section className="sa-ai-panel space-y-4 p-5" aria-label="Cấp gói dịch vụ">
      <h3 className="text-balance text-lg font-semibold">Cấp gói cho doanh nghiệp</h3>
      <label className="sa-ai-label">Doanh nghiệp
        <select className="sa-ai-input" value={company} onChange={event => { setCompany(event.target.value); setCurrent(null); setPlanId(""); setReason(""); setError(""); }}>
          <option value="">Chọn doanh nghiệp</option>{tenants.map(tenant => <option key={tenant.code} value={tenant.code}>{tenant.name} · {tenant.code}</option>)}
        </select>
      </label>
      {company && <div className="space-y-3">
        <div className="rounded-lg border border-outline p-3" aria-busy={currentLoading}>
          {currentLoading ? <p role="status">Đang tải gói hiện tại…</p> : current ?
            <p className="text-pretty"><strong>{current.planName}</strong> · {current.modules.length} phân hệ · {current.status === "active" ? "Hiệu lực đến " + date(current.expiresAt) : current.status === "expired" ? "Đã hết hạn" : "Đã thu hồi"}</p> :
            <p className="sa-ai-muted">Doanh nghiệp chưa có gói dịch vụ.</p>}
        </div>
        <label className="sa-ai-label">Gói cần cấp<select className="sa-ai-input" value={planId} onChange={event => setPlanId(event.target.value)}>
          <option value="">Chọn gói dịch vụ</option>{plans.filter(plan => plan.active).map(plan => <option key={plan._id} value={plan._id}>{plan.name} · {currency(plan.priceVnd)} · {plan.durationDays} ngày</option>)}
        </select></label>
        {selectedPlan && <p className="sa-ai-muted">Phân hệ sẽ bật: {selectedPlan.modules.map(key => MODULE_LABELS[key as ModuleKey] || key).join(", ")}.</p>}
        <label className="sa-ai-label">Lý do cấp hoặc thu hồi<textarea className="sa-ai-input" rows={2} minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="sa-ai-button sa-ai-button-primary" disabled={!selectedPlan || reason.trim().length < 3 || busy || currentLoading} onClick={() => void grant()}>Cấp gói dịch vụ</button>
          {current?.status === "active" && <button type="button" className="sa-ai-button sa-ai-button-danger" disabled={reason.trim().length < 3 || busy || currentLoading} onClick={() => void grant(true)}>Thu hồi gói hiện tại</button>}
        </div>
      </div>}
    </section>
    {error && <p role="alert" className="sa-ai-feedback sa-ai-feedback-error">{error}</p>}
    {notice && <p role="status" className="sa-ai-feedback sa-ai-feedback-success">{notice}</p>}
  </div>;
}
