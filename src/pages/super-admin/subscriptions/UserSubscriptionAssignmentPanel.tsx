import { useEffect, useState, type FormEvent } from "react";
import { aiSubscriptionAdminService as api, formatAiPlanPrice, type AiSubscriptionPlan, type AiSubscriptionSummary } from "../../../services/aiSubscriptionService";
import { superAdminUserAccessService, type SuperAdminUser } from "../../../services/superAdminUserAccessService";

type Props = { plans: AiSubscriptionPlan[]; plansLoading: boolean; plansError: string };
const errorText = (value: unknown) => value instanceof Error ? value.message : "Không thể thực hiện thao tác.";
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");

export default function UserSubscriptionAssignmentPanel({ plans, plansLoading, plansError }: Props) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SuperAdminUser | null>(null);
  const [current, setCurrent] = useState<AiSubscriptionSummary | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [planId, setPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const selectedPlan = plans.find(plan => plan._id === planId && plan.active && plan.priceVnd != null);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoadingCurrent(true);
    void api.userCurrent(selected._id).then(value => { if (active) setCurrent(value); })
      .catch(cause => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoadingCurrent(false); });
    return () => { active = false; };
  }, [selected, revision]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setError(""); setUsers([]);
    try {
      const result = await superAdminUserAccessService.search("SYSTEM", { q: query.trim(), limit: 20 });
      setUsers(result.data.filter(user => user.role !== "superadmin"));
    } catch (cause) { setError(errorText(cause)); }
    finally { setSearching(false); }
  }
  function choose(user: SuperAdminUser) {
    setSelected(user); setCurrent(null); setPlanId(""); setReason(""); setError(""); setNotice("");
  }
  async function grant(cancel = false) {
    if (!selected || busy || loadingCurrent || reason.trim().length < 3 || (!cancel && !selectedPlan) || (cancel && !current)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (cancel) await api.cancelUser(selected._id, reason.trim(), current!._id);
      else await api.assignUser(selected._id, selectedPlan!._id, reason.trim(), current?._id ?? null, selectedPlan!.updatedAt);
      setNotice(cancel ? "Đã thu hồi gói AI của người dùng." : "Đã cấp gói AI cho người dùng.");
      setReason(""); setRevision(value => value + 1);
    } catch (cause) {
      setError(errorText(cause));
      setRevision(value => value + 1);
    } finally { setBusy(false); }
  }
  const effective = current?.status === "active" && Date.parse(current.expiresAt) > Date.now();
  return <div className="sa-ai-panel space-y-5 p-5">
    <div><h3 className="text-balance text-lg font-semibold">Cấp gói AI cho người dùng</h3>
      <p className="sa-ai-muted mt-1 text-pretty">Tìm tài khoản, kiểm tra gói hiện tại rồi cấp hạn mức riêng. Gói này được ưu tiên khi chính tài khoản đó dùng AI.</p></div>
    <form onSubmit={search} className="flex flex-wrap gap-2">
      <label className="min-w-52 flex-1 text-sm">Email hoặc tên người dùng
        <input className="sa-ai-input mt-1 w-full" type="search" value={query} onChange={event => setQuery(event.target.value)} required placeholder="Nhập email hoặc tên" />
      </label>
      <button className="sa-ai-button sa-ai-button-secondary self-end" type="submit" disabled={searching || !query.trim()}>{searching ? "Đang tìm…" : "Tìm người dùng"}</button>
    </form>
    {users.length > 0 && <ul className="max-h-56 space-y-1 overflow-y-auto" aria-label="Kết quả tìm người dùng">
      {users.map(user => <li key={user._id}><button type="button" onClick={() => choose(user)} aria-pressed={selected?._id === user._id}
        className="sa-ai-button sa-ai-button-secondary w-full justify-start text-left">{user.displayName || user.email} · {user.email}</button></li>)}
    </ul>}
    {selected && <div className="space-y-4 border-t border-outline pt-4">
      <div><h4 className="font-semibold">{selected.displayName || selected.email}</h4><p className="sa-ai-muted text-sm">{selected.email}</p></div>
      <div aria-busy={loadingCurrent} className="rounded-lg border border-outline p-3">
        {loadingCurrent ? <p role="status">Đang tải gói hiện tại…</p> : current ?
          <p className="text-pretty text-sm"><strong>{current.planName}</strong> · {current.remaining.toLocaleString("vi-VN")} lượt còn lại · {effective ? "Hiệu lực đến " + date(current.expiresAt) : "Đã hết hạn"}</p> :
          <p className="sa-ai-muted text-sm">Tài khoản chưa có gói AI riêng.</p>}
      </div>
      <label className="sa-ai-label" htmlFor="sa-ai-user-plan">Gói AI
        <select id="sa-ai-user-plan" className="sa-ai-input" value={planId} onChange={event => setPlanId(event.target.value)} disabled={plansLoading || Boolean(plansError) || busy}>
          <option value="">Chọn gói cần cấp</option>
          {plans.filter(plan => plan.active && plan.priceVnd != null).map(plan => <option key={plan._id} value={plan._id}>{plan.name} · {formatAiPlanPrice(plan.priceVnd)} · {plan.aiLimit.toLocaleString("vi-VN")} lượt</option>)}
        </select>
      </label>
      <label className="sa-ai-label" htmlFor="sa-ai-user-reason">Lý do cấp hoặc thu hồi
        <textarea id="sa-ai-user-reason" className="sa-ai-input" rows={2} minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nhập ít nhất 3 ký tự" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="sa-ai-button sa-ai-button-primary" onClick={() => void grant()} disabled={!selectedPlan || reason.trim().length < 3 || busy || loadingCurrent || Boolean(plansError)}>Cấp gói cho người dùng</button>
        {effective && <button type="button" className="sa-ai-button sa-ai-button-danger" onClick={() => void grant(true)} disabled={reason.trim().length < 3 || busy || loadingCurrent}>Thu hồi gói hiện tại</button>}
      </div>
    </div>}
    {error && <p role="alert" className="sa-ai-feedback sa-ai-feedback-error">{error}</p>}
    {notice && <p role="status" className="sa-ai-feedback sa-ai-feedback-success">{notice}</p>}
  </div>;
}
