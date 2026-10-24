import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2, Clock3, Info, Layers3, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { aiSubscriptionAdminService as api, formatAiPlanPrice, type AiSubscriptionPlan, type AiSubscriptionSummary } from "../../../services/aiSubscriptionService";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";

interface Props {
  plans: AiSubscriptionPlan[];
  plansLoading: boolean;
  plansError: string;
  onCreatePlan: () => void;
  onPlansChanged: () => void;
}

const number = (value: number) => value.toLocaleString("vi-VN");
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const message = (cause: unknown) => cause instanceof Error ? cause.message : "Không thể hoàn tất thao tác.";
const statuses: Record<AiSubscriptionSummary["status"], string> = { active: "Đang hiệu lực", expired: "Đã hết hạn", cancelled: "Đã thu hồi", replaced: "Đã thay gói" };

export default function SubscriptionAssignmentPanel({ plans, plansLoading, plansError, onCreatePlan, onPlansChanged }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState("");
  const [tenantRevision, setTenantRevision] = useState(0);
  const [company, setCompany] = useState("");
  const [planId, setPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [subscription, setSubscription] = useState<AiSubscriptionSummary | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentError, setCurrentError] = useState("");
  const [currentRevision, setCurrentRevision] = useState(0);
  const [busy, setBusy] = useState<"assign" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!subscription || subscription.status !== "active") return;
    const delay = Date.parse(subscription.expiresAt) - now;
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, Date.parse(subscription.expiresAt) - Date.now()), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [subscription, now]);

  useEffect(() => {
    let active = true;
    void superAdminTenantService.list().then((items) => { if (active) setTenants(items); })
      .catch((cause) => { if (active) setTenantsError(message(cause)); })
      .finally(() => { if (active) setTenantsLoading(false); });
    return () => { active = false; };
  }, [tenantRevision]);

  useEffect(() => {
    if (!company) return;
    let active = true;
    void api.current(company).then((value) => { if (active) { setSubscription(value); setNow(Date.now()); } })
      .catch((cause) => { if (active) setCurrentError(message(cause)); })
      .finally(() => { if (active) setCurrentLoading(false); });
    return () => { active = false; };
  }, [company, currentRevision]);

  function selectCompany(value: string) {
    setCompany(value);
    setSubscription(null);
    setCurrentError("");
    setError("");
    setNotice("");
    setReason("");
    setPlanId("");
    setCurrentLoading(Boolean(value));
  }

  function refreshCurrent() {
    setCurrentError("");
    setCurrentLoading(true);
    setCurrentRevision((value) => value + 1);
  }

  async function grant(cancel = false) {
    if (busy || !company || currentLoading || currentError || reason.trim().length < 3 || (cancel ? !subscription || !effective : !selectedPlan || plansLoading || Boolean(plansError))) return;
    setBusy(cancel ? "cancel" : "assign");
    setError("");
    setNotice("");
    try {
      if (cancel) await api.cancel(company, reason, subscription!._id);
      else await api.assign(company, planId, reason, subscription?._id ?? null, selectedPlan!.updatedAt);
      setNotice(cancel ? `Đã thu hồi gói AI của ${companyName}.` : `Đã cấp gói “${selectedPlan?.name}” cho ${companyName}.`);
      setReason("");
      refreshCurrent();
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      const uncertain = !status || status >= 500 || status === 408;
      setError(uncertain ? "Chưa xác nhận được kết quả thao tác. Đang tải lại kỳ sử dụng; kiểm tra gói hiện tại trước khi chọn thao tác mới." : message(cause));
      if (uncertain || status === 409) {
        setPlanId("");
        if (uncertain) setReason("");
        refreshCurrent();
        onPlansChanged();
      }
    }
    finally { setBusy(null); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void grant();
  }

  const activePlans = plans.filter((plan) => plan.active && plan.priceVnd != null);
  const selectedPlan = activePlans.find((plan) => plan._id === planId);
  const selectedTenant = tenants.find((tenant) => tenant.code === company);
  const companyName = selectedTenant?.name || company;
  const effective = subscription?.status === "active" && Date.parse(subscription.startsAt) <= now && Date.parse(subscription.expiresAt) > now;
  const available = effective ? subscription.remaining : 0;
  const percentage = subscription && subscription.aiLimit > 0 ? Math.max(0, Math.min(100, available / subscription.aiLimit * 100)) : 0;
  const percentageLabel = percentage > 0 && percentage < 0.1 ? "< 0,1" : number(Math.floor(percentage * 10) / 10);
  const currentStatus = subscription?.status === "active" && Date.parse(subscription.expiresAt) <= now ? "expired" : subscription?.status;
  const unavailable = Boolean(busy) || currentLoading || Boolean(currentError) || !company;

  return <div className="sa-ai-assignment-grid">
    <div className="sa-ai-panel">
      <div className="sa-ai-panel-heading"><div><h3>Cấp gói cho doanh nghiệp</h3><p className="sa-ai-muted">Chọn doanh nghiệp và kiểm tra kỳ hiện tại trước khi cấp gói.</p></div><Building2 size={22} className="sa-ai-accent" aria-hidden="true" /></div>
      <form onSubmit={submit} className="sa-ai-assignment-form">
        <label className="sa-ai-label" htmlFor="sa-ai-company">Doanh nghiệp <span className="sa-ai-required">*</span>
          <select id="sa-ai-company" className="sa-ai-input" value={company} disabled={Boolean(busy) || tenantsLoading || Boolean(tenantsError)} onChange={(event) => selectCompany(event.target.value)} required>
            <option value="">{tenantsLoading ? "Đang tải doanh nghiệp…" : "Chọn doanh nghiệp cần cấp gói"}</option>
            {tenants.map((tenant) => <option key={tenant.code} value={tenant.code}>{tenant.name || tenant.code} · {tenant.code}</option>)}
          </select>
        </label>
        {tenantsError && <div className="sa-ai-feedback sa-ai-feedback-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><div>{tenantsError}<button type="button" className="sa-ai-text-button" onClick={() => { setTenantsError(""); setTenantsLoading(true); setTenantRevision((value) => value + 1); }}>Tải lại doanh nghiệp</button></div></div>}
        {!tenantsLoading && !tenantsError && !tenants.length && <p className="sa-ai-muted">Chưa có doanh nghiệp. Tạo doanh nghiệp trước khi cấp gói AI.</p>}

        {company && <section className="sa-ai-current" aria-label="Gói doanh nghiệp đang sử dụng" aria-busy={currentLoading}>
          <div className="sa-ai-current-heading"><span className="sa-ai-eyebrow">Gói hiện tại · {company}</span><button type="button" className="sa-ai-icon-button" aria-label="Tải lại gói hiện tại" disabled={Boolean(busy) || currentLoading} onClick={refreshCurrent}><RefreshCw size={15} aria-hidden="true" /></button></div>
          {currentLoading ? <p className="sa-ai-loading" role="status"><Loader2 size={17} className="sa-ai-spin" aria-hidden="true" />Đang tải hạn mức…</p>
            : currentError ? <p role="alert" className="sa-ai-error-text">{currentError}</p>
              : subscription ? <>
                <div className="sa-ai-current-title"><h4>{subscription.planName}</h4><span className={"sa-ai-badge " + (effective ? "sa-ai-badge-active" : "sa-ai-badge-neutral")}><span />{currentStatus ? statuses[currentStatus] : "Chưa hiệu lực"}</span></div>
                <p className="sa-ai-current-price">Giá kỳ được cấp: {formatAiPlanPrice(subscription.priceVnd)}</p>
                {(subscription.carriedOver || 0) > 0 && <p className="sa-ai-muted">Đã cộng {number(subscription.carriedOver!)} lượt từ gói trước.</p>}
                <div className="sa-ai-quota-label"><span>Khả dụng <strong>{number(available)} lượt AI</strong></span><strong>{percentageLabel}%</strong></div>
                <div className="sa-ai-progress" role="progressbar" aria-label="Lượt AI khả dụng" aria-valuemin={0} aria-valuemax={Math.max(1, subscription.aiLimit)} aria-valuenow={Math.max(0, Math.min(subscription.aiLimit, available))} aria-valuetext={`${number(available)} trên ${number(subscription.aiLimit)} lượt, khả dụng ${percentageLabel}%`}><span style={{ width: `${percentage}%` }} /></div>
                {!effective && subscription.remaining > 0 && <p className="sa-ai-muted">{number(subscription.remaining)} lượt chưa dùng của kỳ này không còn khả dụng.</p>}
                <div className="sa-ai-usage-meta"><span>Đã dùng {number(subscription.used)}</span><span>Đang giữ {number(subscription.reserved)}</span><span>Tổng {number(subscription.aiLimit)}</span></div>
                <p className="sa-ai-current-dates"><Clock3 size={14} aria-hidden="true" />{date(subscription.startsAt)} – {date(subscription.expiresAt)}</p>
              </> : <div className="sa-ai-no-subscription"><Layers3 size={20} aria-hidden="true" /><div><strong>Doanh nghiệp chưa có gói AI</strong><p className="sa-ai-muted">Chọn một gói bên dưới để bắt đầu sử dụng.</p></div></div>}
        </section>}

        <label className="sa-ai-label" htmlFor="sa-ai-assigned-plan">Gói cần cấp <span className="sa-ai-required">*</span>
          <select id="sa-ai-assigned-plan" className="sa-ai-input" value={planId} disabled={unavailable || plansLoading || Boolean(plansError)} onChange={(event) => { setPlanId(event.target.value); setError(""); setNotice(""); }} required>
            <option value="">{plansLoading ? "Đang tải danh sách gói…" : "Chọn gói AI"}</option>
            {activePlans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name} · {number(plan.aiLimit)} lượt / {number(plan.durationDays)} ngày · {formatAiPlanPrice(plan.priceVnd)}</option>)}
          </select>
        </label>
        {plansError ? <p role="alert" className="sa-ai-error-text">Không thể tải danh mục gói. Hãy làm mới trong tab Danh mục gói.</p>
          : !plansLoading && !activePlans.length && <p className="sa-ai-muted">Chưa có gói đang cung cấp. <button type="button" className="sa-ai-text-button" onClick={onCreatePlan}>Tạo gói AI</button></p>}

        <label className="sa-ai-label" htmlFor="sa-ai-grant-reason">Lý do cấp hoặc thu hồi <span className="sa-ai-required">*</span>
          <textarea id="sa-ai-grant-reason" className="sa-ai-input" rows={2} required minLength={3} maxLength={500} value={reason} disabled={unavailable} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Cấp gói theo đăng ký của doanh nghiệp" />
        </label>
        {error && <div className="sa-ai-feedback sa-ai-feedback-error" role="alert"><TriangleAlert size={18} aria-hidden="true" />{error}</div>}
        {notice && <div className="sa-ai-feedback sa-ai-feedback-success" role="status"><CheckCircle2 size={18} aria-hidden="true" />{notice}</div>}
        <div className="sa-ai-assignment-actions">
          <button type="submit" className="sa-ai-button sa-ai-button-primary" disabled={unavailable || !selectedPlan || plansLoading || Boolean(plansError) || reason.trim().length < 3}>
            {busy === "assign" ? <Loader2 size={17} className="sa-ai-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}{busy === "assign" ? "Đang cấp gói…" : "Cấp gói & bắt đầu kỳ mới"}
          </button>
          {subscription && <button type="button" className="sa-ai-button sa-ai-button-danger" disabled={unavailable || !effective || reason.trim().length < 3} onClick={() => void grant(true)}>{busy === "cancel" && <Loader2 size={16} className="sa-ai-spin" aria-hidden="true" />}{busy === "cancel" ? "Đang thu hồi…" : "Thu hồi gói hiện tại"}</button>}
        </div>
      </form>
    </div>

    <aside className="sa-ai-assignment-preview">
      <div className="sa-ai-panel sa-ai-assignment-summary">
        <p className="sa-ai-eyebrow">Gói sẽ cấp</p>
        {selectedPlan ? <>
          <span className="sa-ai-preview-icon"><Sparkles size={23} aria-hidden="true" /></span>
          <h3>{selectedPlan.name}</h3><span className="sa-ai-code">{selectedPlan.code}</span>
          <p className="sa-ai-muted sa-ai-break">{selectedPlan.description || "Hạn mức AI dùng chung cho toàn doanh nghiệp."}</p>
          <p className="sa-ai-preview-price"><strong>{formatAiPlanPrice(selectedPlan.priceVnd)}</strong><span> / {number(selectedPlan.durationDays)} ngày</span></p>
          <div className="sa-ai-preview-quota"><strong>{number(selectedPlan.aiLimit)}</strong><span>lượt AI / kỳ</span></div>
          {effective && subscription && <p className="sa-ai-muted">Cộng ngay {number(selectedPlan.aiLimit)} lượt mới + {number(subscription.remaining)} lượt cũ khả dụng = {number(selectedPlan.aiLimit + subscription.remaining)} lượt khả dụng sau khi cấp. {subscription.reserved > 0 ? `${number(subscription.reserved)} lượt đang giữ được chuyển sang kỳ mới.` : ""}</p>}
          <p className="sa-ai-preview-duration"><Clock3 size={17} aria-hidden="true" />{number(selectedPlan.durationDays)} ngày kể từ lúc cấp</p>
          <div className="sa-ai-recipient"><Building2 size={18} aria-hidden="true" /><div><span className="sa-ai-muted">Doanh nghiệp nhận gói</span><strong>{companyName}</strong><span className="sa-ai-code">{company}</span></div></div>
        </> : <div className="sa-ai-empty sa-ai-empty-compact"><span className="sa-ai-empty-icon"><Layers3 size={25} aria-hidden="true" /></span><h4>Chọn gói cần cấp</h4><p>Hạn mức và thời hạn của gói sẽ hiển thị tại đây.</p></div>}
      </div>
      <div className="sa-ai-assignment-note"><Info size={19} aria-hidden="true" /><div><strong>Cộng lượt ngay khi cấp gói</strong><p>Gói mới bắt đầu từ hiện tại. Lượt chưa dùng của gói cũ còn hiệu lực được cộng sang, bao gồm lượt đang giữ cho tác vụ. Lượt của gói hết hạn hoặc đã thu hồi không được chuyển.</p></div></div>
    </aside>
  </div>;
}
