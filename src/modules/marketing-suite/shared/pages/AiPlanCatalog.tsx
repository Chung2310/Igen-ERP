import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, Copy, Layers3, Sparkles } from "lucide-react";
import {
  getAvailableAiSubscriptionPlans,
  formatAiPlanPrice,
  type AiSubscriptionPlan,
  type AiSubscriptionSummary,
} from "../../../../services/aiSubscriptionService";

const number = (value: number) => value.toLocaleString("vi-VN");
const duration = (days: number) => `${number(days)} ngày`;

export default function AiPlanCatalog({ subscription, revision, companyName }: {
  subscription: AiSubscriptionSummary | null; revision: number; companyName?: string;
}) {
  const [plans, setPlans] = useState<AiSubscriptionPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const value = await getAvailableAiSubscriptionPlans(controller.signal);
        if (active) { setPlans(value); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách gói AI.");
      } finally {
        pending = false;
        if (active) setLoaded(true);
      }
    };
    const onRefresh = () => { void refresh(); };
    onRefresh();
    const timer = window.setInterval(onRefresh, 60_000);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [revision]);

  const durations = [...new Set(plans.map((plan) => plan.durationDays))].sort((a, b) => a - b);
  const activeDays = selectedDays !== null && durations.includes(selectedDays) ? selectedDays : null;
  const visiblePlans = activeDays === null ? plans : plans.filter((plan) => plan.durationDays === activeDays);
  const selectedPlan = plans.find((plan) => plan._id === selectedId);
  const requestText = selectedPlan ? [
    `Doanh nghiệp: ${companyName || "Chưa có tên doanh nghiệp"}`,
    `Gói AI: ${selectedPlan.name} (${selectedPlan.code})`,
    `Hạn mức: ${number(selectedPlan.aiLimit)} lượt AI dùng chung`,
    `Thời hạn: ${duration(selectedPlan.durationDays)} kể từ khi được cấp gói`,
    `Giá trọn gói: ${formatAiPlanPrice(selectedPlan.priceVnd)}`,
    "Nhờ Superadmin kiểm tra và cấp gói cho doanh nghiệp.",
  ].join("\n") : "";

  const copyRequest = async () => {
    if (!selectedPlan) return;
    const planId = selectedPlan._id;
    try {
      await navigator.clipboard.writeText(requestText);
      setCopiedId(planId); setCopyError("");
    } catch {
      setCopyError("Chưa thể sao chép. Bạn có thể chọn và sao chép nội dung bên dưới.");
    }
  };

  return <section className="space-y-4" aria-labelledby="ai_plan_catalog_title" aria-busy={!loaded}>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="ai_plan_catalog_title" className="text-lg font-semibold tracking-tight">Xem gói & nâng cấp</h2>
        <p className="ai-subscription-muted mt-1 text-sm leading-6">So sánh giá, lượt AI và thời hạn để chọn gói nâng cấp hoặc gia hạn.</p>
      </div>
      {loaded && durations.length > 1 && <div className="ai-plan-filters flex max-w-full flex-wrap items-center gap-1 rounded-xl p-1" role="group" aria-label="Lọc gói theo thời hạn">
        {[null, ...durations].map((days) => <button key={days ?? "all"} type="button" aria-pressed={activeDays === days} onClick={() => setSelectedDays(days)} className={`ai-plan-duration rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeDays === days ? "ai-plan-duration-active" : ""}`}>
          {days === null ? "Tất cả" : duration(days)}
        </button>)}
      </div>}
    </div>

    {error && <div role="alert" className="ai-subscription-notice flex items-start gap-2 rounded-xl border p-3 text-sm leading-6">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{error} {plans.length > 0 ? "Đang hiển thị danh sách tải thành công gần nhất." : "Bấm Làm mới để thử lại."}</p>
    </div>}

    {!loaded ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải danh sách gói AI" role="status">
      {[0, 1, 2].map((index) => <div key={index} className="ai-subscription-panel space-y-6 p-6" aria-hidden="true">
        <div className="ai-subscription-skeleton h-6 w-1/2 rounded motion-safe:animate-pulse" />
        <div className="ai-subscription-skeleton h-12 w-2/3 rounded motion-safe:animate-pulse" />
        <div className="ai-subscription-skeleton h-24 rounded motion-safe:animate-pulse" />
        <div className="ai-subscription-skeleton h-10 rounded-lg motion-safe:animate-pulse" />
      </div>)}
      <span className="sr-only">Đang tải danh sách gói AI...</span>
    </div> : plans.length > 0 ? <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visiblePlans.map((plan) => {
        const samePlan = subscription?.planId === plan._id;
        const current = subscription?.status === "active" && samePlan;
        const selected = selectedId === plan._id;
        return <article key={plan._id} className={`ai-subscription-panel ai-plan-card flex min-w-0 flex-col p-5 sm:p-6 ${current ? "ai-plan-card-current" : ""} ${selected ? "ai-plan-card-selected" : ""}`}>
          <div className="mb-4 flex min-h-7 flex-wrap items-center justify-between gap-2">
            <span className="ai-plan-code break-all rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wide">{plan.code}</span>
            {current && <span className="ai-subscription-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"><Check className="h-3.5 w-3.5" aria-hidden="true" />Gói đang dùng</span>}
          </div>
          <h3 className="break-words text-xl font-semibold">{plan.name}</h3>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-2xl font-semibold tracking-tight tabular-nums">{formatAiPlanPrice(plan.priceVnd)}</strong><span className="ai-subscription-muted text-sm">/ {duration(plan.durationDays)}</span></p>
          <div className="ai-plan-quota my-5 border-y py-5">
            <p className="ai-subscription-accent flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">{number(plan.aiLimit)}</span><span className="text-sm font-medium">lượt AI</span>
            </p>
            <p className="ai-subscription-muted mt-3 flex items-start gap-2 text-sm leading-6"><CalendarDays className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />Có hiệu lực {duration(plan.durationDays)} từ khi được cấp</p>
          </div>
          {plan.description && <p className="ai-subscription-muted mb-5 whitespace-pre-line break-words text-sm leading-6">{plan.description}</p>}
          <ul className="mb-6 space-y-2.5 text-sm leading-6">
            {[
              "Hạn mức dùng chung cho doanh nghiệp",
              "Mỗi lời gọi AI thành công tính 1 lượt",
            ].map((text) => <li key={text} className="flex items-start gap-2"><Check className="ai-subscription-accent mt-1 h-4 w-4 shrink-0" aria-hidden="true" /><span>{text}</span></li>)}
          </ul>
          <button type="button" onClick={() => { setSelectedId(plan._id); setCopiedId(""); setCopyError(""); }} aria-expanded={selected} aria-controls="ai_plan_activation" className="ai-plan-action mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors">
            {selected ? "Đang chọn gói này" : samePlan ? "Gia hạn gói" : subscription && plan.aiLimit > subscription.aiLimit ? "Nâng cấp gói" : "Chọn gói này"}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </article>;
      })}
    </div> : !error && <div className="ai-plan-empty flex items-start gap-3 rounded-xl border border-dashed p-5 sm:p-6">
      <Layers3 className="ai-subscription-muted mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-medium">Chưa có gói khả dụng</h3>
        <p className="ai-subscription-muted mt-1 text-sm leading-6">Các gói sẽ xuất hiện sau khi Superadmin thiết lập số lượt AI, thời hạn và bật cung cấp.</p>
      </div>
    </div>}

    <div id="ai_plan_activation" aria-live="polite" hidden={!selectedPlan}>
      {selectedPlan && <div className="ai-subscription-panel ai-plan-selection grid gap-4 p-5 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="ai-subscription-accent h-4 w-4" aria-hidden="true" />Gói đã chọn: {selectedPlan.name}</h3>
          <p className="ai-subscription-muted mt-2 text-sm leading-6">Để nâng cấp hoặc gia hạn, sao chép thông tin bên dưới và gửi cho Superadmin. Gói mới chỉ có hiệu lực sau khi được Superadmin cấp.</p>
          <p className="ai-subscription-muted mt-2 text-sm leading-6">Gói mới bắt đầu ngay khi được cấp và thay thế kỳ hiện tại. Lượt còn lại của kỳ cũ không cộng dồn.</p>
          <button type="button" onClick={() => { void copyRequest(); }} className="ai-subscription-refresh mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
            {copiedId === selectedPlan._id ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copiedId === selectedPlan._id ? "Đã sao chép thông tin" : "Sao chép thông tin nâng cấp"}
          </button>
          {copyError && <p role="alert" className="ai-subscription-muted mt-2 text-sm leading-6">{copyError}</p>}
        </div>
        <p className="ai-subscription-inset select-text whitespace-pre-line break-words rounded-xl p-4 text-sm leading-6">{requestText}</p>
      </div>}
    </div>
    {plans.length > 0 && <p className="ai-subscription-muted text-sm leading-6">Superadmin quản lý việc cấp và đổi gói. Thay đổi cấu hình gói áp dụng cho lần cấp tiếp theo.</p>}
  </section>;
}
