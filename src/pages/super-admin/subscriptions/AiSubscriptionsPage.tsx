import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Layers3, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, TriangleAlert } from "lucide-react";
import { aiSubscriptionAdminService as api, formatAiPlanPrice, type AiSubscriptionPlan } from "../../../services/aiSubscriptionService";
import SubscriptionPlanDialog from "./SubscriptionPlanDialog";
import SubscriptionAssignmentPanel from "./SubscriptionAssignmentPanel";
import "./ai-subscriptions-admin.css";

const number = (value: number) => value.toLocaleString("vi-VN");

export default function AiSubscriptionsPage() {
  const [view, setView] = useState<"plans" | "companies">("plans");
  const [plans, setPlans] = useState<AiSubscriptionPlan[]>([]);
  const [editor, setEditor] = useState<{ plan: AiSubscriptionPlan | null } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void api.plans().then((items) => { if (active) setPlans(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách gói AI."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  function refresh() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  function createPlan() {
    setNotice("");
    setEditor({ plan: null });
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const visiblePlans = plans.filter((plan) =>
    (filter === "all" || (filter === "active" ? plan.active : !plan.active))
    && (plan.name + " " + plan.code + " " + plan.description).toLocaleLowerCase("vi-VN").includes(normalizedQuery));
  const activeCount = plans.filter((plan) => plan.active).length;

  return (
    <section className="sa-ai" aria-labelledby="sa-ai-title">
      <header className="sa-ai-page-header">
        <div className="sa-ai-heading-group">
          <span className="sa-ai-page-icon"><Sparkles size={22} aria-hidden="true" /></span>
          <div>
            <p className="sa-ai-eyebrow">Quản lý dịch vụ</p>
            <h2 id="sa-ai-title">Gói AI & hạn mức</h2>
            <p className="sa-ai-muted">Thiết lập giá, số lượt, thời hạn và cấp gói dùng chung cho từng doanh nghiệp.</p>
          </div>
        </div>
        <button type="button" className="sa-ai-button sa-ai-button-primary" disabled={loading} onClick={createPlan}>
          <Plus size={17} aria-hidden="true" />Tạo gói AI
        </button>
      </header>

      <nav className="sa-ai-tabs" aria-label="Quản lý gói AI">
        <button type="button" aria-pressed={view === "plans"} aria-controls="sa-ai-plans" onClick={() => setView("plans")}>
          <Layers3 size={17} aria-hidden="true" />Danh mục gói<span className="sa-ai-count">{plans.length}</span>
        </button>
        <button type="button" aria-pressed={view === "companies"} aria-controls="sa-ai-companies" onClick={() => setView("companies")}>
          <Building2 size={17} aria-hidden="true" />Cấp gói doanh nghiệp
        </button>
      </nav>

      {notice && <div className="sa-ai-feedback sa-ai-feedback-success" role="status"><CheckCircle2 size={18} aria-hidden="true" />{notice}</div>}

      <section id="sa-ai-plans" hidden={view !== "plans"} aria-labelledby="sa-ai-catalog-title">
        <div className="sa-ai-panel">
          <div className="sa-ai-panel-heading">
            <div>
              <h3 id="sa-ai-catalog-title">Danh sách gói AI</h3>
              <p className="sa-ai-muted">{loading ? "Đang tải danh mục…" : activeCount + " gói đang cung cấp · " + (plans.length - activeCount) + " gói ngừng cấp mới"}</p>
            </div>
            <button type="button" className="sa-ai-button sa-ai-button-secondary" disabled={loading} onClick={refresh}>
              {loading ? <Loader2 size={16} className="sa-ai-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}Làm mới
            </button>
          </div>
          <div className="sa-ai-toolbar">
            <label className="sa-ai-search">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc mã gói…" aria-label="Tìm gói AI" />
            </label>
            <select className="sa-ai-input sa-ai-filter" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc trạng thái gói">
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang cung cấp</option>
              <option value="inactive">Ngừng cấp mới</option>
            </select>
          </div>

          {error ? <div className="sa-ai-feedback sa-ai-feedback-error sa-ai-inset" role="alert"><TriangleAlert size={18} aria-hidden="true" />{error}</div>
            : loading ? <div className="sa-ai-empty" role="status"><Loader2 size={26} className="sa-ai-spin" aria-hidden="true" /><p>Đang tải các gói AI…</p></div>
              : visiblePlans.length ? <>
                <div className="sa-ai-plan-columns" aria-hidden="true"><span>Thông tin gói</span><span>Hạn mức AI</span><span>Giá trọn gói</span><span>Thời hạn</span><span>Trạng thái</span><span /></div>
                <ul className="sa-ai-plan-list">
                  {visiblePlans.map((plan) => <li key={plan._id} className="sa-ai-plan-row">
                    <div className="sa-ai-plan-identity">
                      <span className="sa-ai-plan-icon"><Layers3 size={19} aria-hidden="true" /></span>
                      <div><h4>{plan.name}</h4><span className="sa-ai-code">{plan.code}</span>{plan.description && <p className="sa-ai-plan-description">{plan.description}</p>}</div>
                    </div>
                    <div className="sa-ai-plan-metric"><span className="sa-ai-mobile-label">Hạn mức AI</span><strong>{number(plan.aiLimit)}</strong><span className="sa-ai-muted">lượt / kỳ</span></div>
                    <div className="sa-ai-plan-price"><span className="sa-ai-mobile-label">Giá trọn gói</span><strong>{formatAiPlanPrice(plan.priceVnd)}</strong></div>
                    <div className="sa-ai-plan-duration"><span className="sa-ai-mobile-label">Thời hạn</span><strong>{number(plan.durationDays)} ngày</strong></div>
                    <span className={"sa-ai-badge " + (plan.active ? "sa-ai-badge-active" : "sa-ai-badge-neutral")}><span />{plan.active ? "Đang cung cấp" : "Ngừng cấp mới"}</span>
                    <button type="button" className="sa-ai-button sa-ai-button-secondary sa-ai-edit-button" onClick={() => { setNotice(""); setEditor({ plan }); }} aria-label={"Chỉnh sửa gói " + plan.name}><Pencil size={15} aria-hidden="true" />Sửa</button>
                  </li>)}
                </ul>
                <p className="sa-ai-list-footer">Hiển thị {visiblePlans.length} / {plans.length} gói. Hạn mức được dùng chung cho tất cả thành viên trong doanh nghiệp.</p>
              </> : <div className="sa-ai-empty">
                <span className="sa-ai-empty-icon"><Layers3 size={25} aria-hidden="true" /></span>
                <h4>{plans.length ? "Không tìm thấy gói phù hợp" : "Tạo gói AI đầu tiên"}</h4>
                <p>{plans.length ? "Thử tên, mã gói hoặc trạng thái khác." : "Đặt số lượt AI và thời hạn để bắt đầu cấp gói cho doanh nghiệp."}</p>
                {plans.length ? <button type="button" className="sa-ai-button sa-ai-button-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Xóa bộ lọc</button>
                  : <button type="button" className="sa-ai-button sa-ai-button-primary" onClick={createPlan}><Plus size={16} aria-hidden="true" />Tạo gói AI</button>}
              </div>}
        </div>
      </section>

      <section id="sa-ai-companies" hidden={view !== "companies"} aria-label="Cấp gói cho doanh nghiệp">
        <SubscriptionAssignmentPanel plans={plans} plansLoading={loading} plansError={error} onCreatePlan={createPlan} />
      </section>

      {editor && <SubscriptionPlanDialog key={editor.plan?._id || "new"} plan={editor.plan} onClose={() => setEditor(null)} onSaved={(name) => {
        setNotice((editor.plan ? "Đã cập nhật gói “" : "Đã tạo gói “") + name + "”.");
        setEditor(null);
        refresh();
      }} />}
    </section>
  );
}
