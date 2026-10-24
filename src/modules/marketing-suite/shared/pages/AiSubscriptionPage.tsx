import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, Building2, CalendarDays, CheckCheck,
  ChevronDown, CircleHelp, Clock3, Layers3, RefreshCw, RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { getCurrentAiSubscription, formatAiPlanPrice, type AiSubscriptionSummary } from "../../../../services/aiSubscriptionService";
import AiPlanCatalog from "./AiPlanCatalog";
import { socketService } from "../../../../services/socketService";
import "./ai-subscription.css";

const number = (value: number) => value.toLocaleString("vi-VN");
const date = (value: string) => new Date(value).toLocaleString("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export default function AiSubscriptionPage() {
  const { userProfile } = useAuth();
  return <CompanyAiSubscription key={`${userProfile?.uid}:${userProfile?.companyCode}`} companyName={userProfile?.companyName || userProfile?.companyCode} companyCode={userProfile?.companyCode} />;
}

function CompanyAiSubscription({ companyName, companyCode }: { companyName?: string; companyCode?: string }) {
  const [subscription, setSubscription] = useState<AiSubscriptionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now);
  const [view, setView] = useState<"usage" | "plans">("usage");
  const plansButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    let pending = false;
    let refreshAgain = false;
    const controller = new AbortController();
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      if (pending) { refreshAgain = true; return; }
      pending = true;
      try {
        const value = await getCurrentAiSubscription(controller.signal);
        if (active) { setSubscription(value); setError(""); setUpdatedAt(new Date()); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải hạn mức AI.");
      } finally {
        pending = false;
        if (active) { setLoaded(true); setRefreshing(false); }
        if (active && refreshAgain) { refreshAgain = false; void load(); }
      }
    };
    const refresh = () => { setNow(Date.now()); void load(); };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const unsubscribe = socketService.on("ai-subscription:updated", (event: { companyCode: string }) => {
      if (event.companyCode === companyCode) refresh();
    });
    const unsubscribeStatus = socketService.onStatusChange((connected) => { if (connected) refresh(); });
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      unsubscribe(); unsubscribeStatus();
    };
  }, [revision, companyCode]);

  useEffect(() => {
    if (!subscription || subscription.status !== "active") return;
    const expiresAt = Date.parse(subscription.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, expiresAt - Date.now())));
    return () => window.clearTimeout(timer);
  }, [subscription, now]);

  const currentSubscription = subscription?.status === "active" && Date.parse(subscription.expiresAt) <= now
    ? { ...subscription, status: "expired" as const } : subscription;
  const available = currentSubscription?.status === "active" ? currentSubscription.remaining : 0;
  const status = !currentSubscription ? "Chưa được cấp gói" : currentSubscription.status !== "active" ? "Đã hết hiệu lực" : available === 0 ? "Đã hết lượt" : "Đang sử dụng";
  const unavailable = !currentSubscription || currentSubscription.status !== "active" || available === 0;
  const remainingPercent = subscription ? Math.min(100, Math.max(0, available / Math.max(1, subscription.aiLimit) * 100)) : 0;
  const remainingTenths = subscription ? Math.min(1000, Math.max(0, Math.floor(available * 1000 / Math.max(1, subscription.aiLimit)))) : 0;
  const remainingPercentLabel = available > 0 && remainingTenths === 0 ? "< 0,1%" : `${number(remainingTenths / 10)}%`;
  const refresh = () => { setRefreshing(true); setRevision((value) => value + 1); };
  const openPlans = () => { setView("plans"); plansButton.current?.focus(); };

  return (
    <div className="ai-subscription-page mx-auto grid w-full max-w-7xl gap-6 pb-6 font-sans" id="company_ai_subscription_page" aria-busy={!loaded || refreshing}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Gói AI & lượt sử dụng</h1>
          <p className="ai-subscription-muted mt-2 text-sm leading-6">Theo dõi lượt AI của bạn trong hạn mức dùng chung của doanh nghiệp.</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {companyName && <span className="ai-subscription-company inline-flex max-w-64 items-center gap-2 rounded-lg px-3 py-2 text-sm"><Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{companyName}</span></span>}
          <button type="button" disabled={refreshing || !loaded} onClick={refresh} className="ai-subscription-refresh inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing || !loaded ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            {refreshing ? "Đang cập nhật..." : "Làm mới"}
          </button>
          <button type="button" onClick={openPlans} aria-controls="ai_subscription_plans" className="ai-plan-action inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />Nâng cấp gói
          </button>
        </div>
      </header>

      <div className="ai-subscription-view-switch flex flex-wrap gap-1 border-b pb-2" role="group" aria-label="Thông tin sử dụng và nâng cấp gói AI">
        <button type="button" aria-pressed={view === "usage"} aria-controls="ai_subscription_usage" onClick={() => setView("usage")} className={`ai-subscription-view inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${view === "usage" ? "ai-subscription-view-active" : ""}`}>
          <Layers3 className="h-4 w-4" aria-hidden="true" />Hạn mức sử dụng
        </button>
        <button ref={plansButton} type="button" aria-pressed={view === "plans"} aria-controls="ai_subscription_plans" onClick={openPlans} className={`ai-subscription-view inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${view === "plans" ? "ai-subscription-view-active" : ""}`}>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />Gói & nâng cấp
        </button>
      </div>

      {error && <div role="alert" className="ai-subscription-notice flex items-start gap-3 rounded-xl border p-4 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Chưa cập nhật được thông tin gói AI</p>
          <p className="mt-1 text-sm leading-6">{error} {subscription ? "Các số liệu đang hiển thị là lần tải thành công gần nhất." : "Bạn có thể bấm Làm mới để thử lại."}</p>
        </div>
      </div>}
      {!loaded && <p role="status" className="sr-only">Đang tải gói AI và hạn mức của doanh nghiệp...</p>}

      <div id="ai_subscription_usage" hidden={view !== "usage"}>
      <div className="space-y-5">
      <section className="ai-subscription-panel overflow-hidden" aria-labelledby="ai_subscription_plan_title">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
            <h2 id="ai_subscription_plan_title" className="text-base font-semibold">
              Gói đang sử dụng
            </h2>
            {(subscription || loaded && !error) && <span className={`ai-subscription-badge ${subscription && unavailable ? "ai-subscription-badge-warning" : ""} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{status}
            </span>}
          </div>
          {subscription ? <>
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2 lg:gap-10">
            <div className="min-w-0">
              <h3 className="break-words text-2xl font-semibold tracking-tight">{subscription.planName}</h3>
              <p className="ai-subscription-secondary mt-2 text-sm">Giá kỳ được cấp: <strong className="font-semibold tabular-nums">{formatAiPlanPrice(subscription.priceVnd)}</strong></p>
              {(subscription.carriedOver || 0) > 0 && <p className="ai-subscription-muted mt-2 text-sm">Đã cộng {number(subscription.carriedOver!)} lượt chuyển từ gói trước vào hạn mức kỳ này.</p>}
              <button type="button" onClick={openPlans} className="ai-subscription-upgrade-link mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium">
                Xem gói và nâng cấp<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Bắt đầu kỳ sử dụng", value: subscription.startsAt },
                { label: "Ngày hết hạn", value: subscription.expiresAt },
              ].map((item) => <div key={item.label}>
                <dt className="ai-subscription-muted mb-1.5 flex items-center gap-1.5 text-sm"><CalendarDays className="h-4 w-4" aria-hidden="true" />{item.label}</dt>
                <dd className="text-sm font-medium tabular-nums">{date(item.value)}</dd>
              </div>)}
              </dl>
            </div>
            <div className="ai-subscription-balance min-w-0 rounded-xl p-4 sm:p-5">
              <p id="ai_subscription_remaining_title" className="ai-subscription-secondary text-sm font-medium">Hạn mức AI còn lại</p>
              <div className="my-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">{number(available)}</p>
                  <p className="ai-subscription-secondary mt-1 text-sm">/ {number(subscription.aiLimit)} lượt AI trong kỳ</p>
                </div>
                <div className="ai-subscription-remaining-percent rounded-xl px-3 py-2 text-right">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">{remainingPercentLabel}</p>
                  <p className="mt-0.5 text-xs">còn lại</p>
                </div>
              </div>
              <div className="ai-subscription-meter h-3 overflow-hidden rounded-full" role="progressbar" aria-labelledby="ai_subscription_remaining_title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={remainingPercent} aria-valuetext={`Còn ${remainingPercentLabel}, ${number(available)} trên ${number(subscription.aiLimit)} lượt AI khả dụng`}>
                <div className="ai-subscription-meter-remaining h-full rounded-full" style={{ width: `${remainingPercent}%` }} />
              </div>
              <p className="ai-subscription-secondary mt-3 text-sm leading-6">Số lượt còn dùng được để AI trả lời tự động và tạo nội dung.</p>
            </div>
          </div>
          <dl className="ai-subscription-summary-stats grid grid-cols-1 border-t sm:grid-cols-3">
            <QuotaStat label="Đã sử dụng" value={subscription.used} icon={CheckCheck} />
            <QuotaStat label="Đang giữ cho tác vụ" value={subscription.reserved} icon={Clock3} />
            <QuotaStat label="Tổng hạn mức trong kỳ" value={subscription.aiLimit} icon={Layers3} />
          </dl>
            {unavailable && <div className="ai-subscription-notice mx-5 mb-5 flex flex-wrap items-start gap-2 rounded-xl border p-3 text-sm leading-6 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Gói hiện tại {currentSubscription?.status !== "active" ? "đã hết hiệu lực" : "đã hết lượt khả dụng"}. Liên hệ Superadmin để được cấp gói phù hợp.</p>
              <button type="button" onClick={openPlans} className="shrink-0 self-center font-semibold underline underline-offset-4">Xem các gói</button>
            </div>}
          </> : !loaded ? <div className="space-y-4 p-5 sm:p-6" aria-hidden="true">
            <div className="ai-subscription-skeleton h-7 w-2/5 rounded-lg motion-safe:animate-pulse" />
            <div className="ai-subscription-skeleton h-12 rounded-xl motion-safe:animate-pulse" />
            <div className="ai-subscription-skeleton h-2.5 rounded-full motion-safe:animate-pulse" />
          </div> : <div className="flex items-start gap-4 p-5 sm:p-6">
            <span className="ai-subscription-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              {error ? <AlertCircle className="h-6 w-6" aria-hidden="true" /> : <Layers3 className="h-6 w-6" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-medium">{error ? "Chưa thể hiển thị thông tin gói" : "Doanh nghiệp chưa được cấp gói AI"}</h3>
              <p className="ai-subscription-muted mt-1 text-sm leading-6">{error ? "Làm mới để tải lại thông tin gói và hạn mức của doanh nghiệp." : "Khi được cấp gói, hạn mức và thời hạn sử dụng sẽ hiển thị tại đây."}</p>
              {!error && <button type="button" onClick={openPlans} className="ai-subscription-upgrade-link mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium">Xem các gói AI<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></button>}
            </div>
          </div>}
      </section>

      <details className="ai-subscription-panel ai-subscription-help overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
            <CircleHelp className="ai-subscription-accent h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Cách tính lượt AI</h2><p className="ai-subscription-muted mt-1 text-sm leading-6">Mỗi lời gọi AI thành công tính 1 lượt. Một lần trả lời hoặc tạo nội dung có thể cần nhiều lượt.</p></div>
            <ChevronDown className="ai-subscription-help-chevron ai-subscription-muted h-4 w-4 shrink-0" aria-hidden="true" />
          </summary>
          <ul className="ai-subscription-panel-footer grid gap-5 p-5 lg:grid-cols-3">
            {[
              { icon: CheckCheck, title: "Thành công mới tính lượt", text: "Mỗi lời gọi AI thành công tính 1 lượt sử dụng." },
              { icon: RotateCcw, title: "Giải phóng lượt khi thất bại", text: "Lời gọi thất bại được trả lại lượt đang giữ. Kết quả chưa xác định được giữ chờ đối soát." },
              { icon: Layers3, title: "Campaign tính theo từng bước", text: "Tổng lượt AI dự kiến được hiển thị trước khi bạn xác nhận chạy." },
            ].map(({ icon: Icon, title, text }) => <li key={title} className="flex items-start gap-3">
              <span className="ai-subscription-inset flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Icon className="ai-subscription-accent h-4 w-4" aria-hidden="true" /></span>
              <div><h3 className="text-sm font-medium leading-6">{title}</h3><p className="ai-subscription-muted mt-1 text-sm leading-6">{text}</p></div>
            </li>)}
          </ul>
          <div className="ai-subscription-panel-footer ai-subscription-inset flex items-start gap-2 px-5 py-4">
            <Building2 className="ai-subscription-muted mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="ai-subscription-muted text-sm leading-6">Campaign, Message Facebook và các công cụ AI cùng sử dụng hạn mức doanh nghiệp.</p>
          </div>
      </details>
      </div>
      </div>

      <div id="ai_subscription_plans" hidden={view !== "plans"}>
        <div className="space-y-5">
          {subscription && <div className="ai-subscription-panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm sm:px-5">
            <p>Gói hiện tại: <strong className="font-semibold">{subscription.planName}</strong></p>
            <p className="ai-subscription-muted">Còn <strong className="ai-subscription-secondary font-semibold tabular-nums">{number(available)}</strong> lượt khả dụng · {status}</p>
          </div>}
          <AiPlanCatalog subscription={currentSubscription} revision={revision} companyName={companyName} />
        </div>
      </div>
      <footer className="ai-subscription-muted flex flex-wrap items-center justify-between gap-2 px-1 text-xs leading-5">
        <p>Gói và hạn mức do Superadmin quản lý.</p>
        <p>{updatedAt ? `Cập nhật ${updatedAt.toLocaleTimeString("vi-VN")} · ` : ""}Cập nhật ngay khi đổi gói, tự làm mới mỗi phút.</p>
      </footer>
    </div>
  );
}

function QuotaStat({ label, value, icon: Icon }: {
  label: string; value: number; icon: LucideIcon;
}) {
  return <div className="ai-subscription-stat flex min-w-0 items-center justify-between gap-3 px-5 py-4 sm:px-6">
    <dt className="ai-subscription-muted flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}
    </dt>
    <dd className="shrink-0 text-lg font-semibold tabular-nums">{number(value)}</dd>
  </div>;
}
