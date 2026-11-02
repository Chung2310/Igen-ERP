import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, Building2, Layers3, RefreshCw,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { getCurrentAiSubscription, type AiSubscriptionSummary } from "../../../../services/aiSubscriptionService";
import AiPlanCatalog from "./AiPlanCatalog";
import AiSubscriptionHistory from "./AiSubscriptionHistory";
import { socketService } from "../../../../services/socketService";
import { ModuleNavigation, ModuleNavigationButton } from "../../../../components/common/ModuleNavigation";
import { cn } from "../../../student-management/lib/utils";
import "./ai-subscription.css";

const number = (value: number) => value.toLocaleString("vi-VN");


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
  const [mobileDock, setMobileDock] = useState<HTMLDivElement | null>(null);
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

  const quotaKnown = loaded && (!error || Boolean(subscription));
  const historyKey = revision + ':' + (subscription?._id || 'none') + ':' + (currentSubscription?.status || 'none');

  return (
    <div className="ai-subscription-page flex h-full min-h-0 flex-col bg-surface font-sans" id="company_ai_subscription_page" aria-busy={!loaded || refreshing}>
      <ModuleNavigation label="Hạn mức và nâng cấp gói AI" activeValue={view}>
        <ModuleNavigationButton active={view === 'usage'} icon={<Layers3 />} aria-pressed={view === 'usage'} aria-controls="ai_subscription_usage" onClick={() => setView('usage')}>Hạn mức</ModuleNavigationButton>
        <ModuleNavigationButton ref={plansButton} active={view === 'plans'} icon={<ArrowUpRight />} aria-pressed={view === 'plans'} aria-controls="ai_subscription_plans" onClick={openPlans}>Gói nâng cấp</ModuleNavigationButton>
      </ModuleNavigation>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <header className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-balance text-xl font-semibold sm:text-2xl">{view === 'usage' ? 'Hạn mức AI' : 'Nâng cấp gói AI'}</h1>
            <div className="flex shrink-0 items-center gap-3">{companyName && <span title={companyName} className="hidden max-w-48 items-center gap-1.5 text-xs text-on-surface-variant md:flex"><Building2 className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{companyName}</span></span>}<button type="button" disabled={refreshing || !loaded} onClick={refresh} aria-label={refreshing ? 'Đang cập nhật' : 'Làm mới'} className="ai-subscription-back"><RefreshCw className="size-4" aria-hidden="true" /><span className="hidden text-xs sm:inline">{refreshing ? 'Đang cập nhật…' : 'Làm mới'}</span></button></div>
          </header>
          {error && <div role="alert" className="ai-subscription-notice flex items-start gap-3 rounded-xl border p-4"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-semibold">Chưa cập nhật được hạn mức AI</p><p className="mt-1 text-pretty text-sm leading-6">{error} {subscription ? 'Số liệu hiển thị là lần tải thành công gần nhất.' : 'Bấm Làm mới để thử lại.'}</p></div></div>}
          <div id="ai_subscription_usage" hidden={view !== 'usage'} className="space-y-5">
            <section className="ai-subscription-panel p-5" aria-labelledby="ai_subscription_remaining_title">
              {!loaded ? <div role="status" className="flex flex-wrap items-center gap-5"><h2 id="ai_subscription_remaining_title" className="sr-only">Hạn mức còn lại</h2><span className="sr-only">Đang tải hạn mức AI…</span><div aria-hidden="true" className="ai-subscription-skeleton h-16 w-48 rounded-xl" /><div aria-hidden="true" className="ai-subscription-skeleton h-3 min-w-48 flex-1 rounded-full" /></div> : <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
                <div className="min-w-0"><h2 id="ai_subscription_remaining_title" className="text-balance text-sm font-medium text-on-surface-variant">Hạn mức còn lại</h2><p className="mt-2 break-words text-4xl font-semibold tabular-nums">{quotaKnown ? number(available) : '—'} <span className="text-sm font-normal text-on-surface-variant">lượt AI</span></p></div>
                <div className="w-full space-y-2 sm:max-w-xl sm:flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums">{quotaKnown ? 'Còn ' + remainingPercentLabel : 'Chưa xác định hạn mức'}</span>{quotaKnown && <span className={cn('ai-subscription-badge', unavailable && 'ai-subscription-badge-warning')}>{status}</span>}</div>
                  <div className="ai-subscription-meter h-2.5 overflow-hidden rounded-full" data-low={remainingPercent < 10} role="progressbar" aria-labelledby="ai_subscription_remaining_title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={quotaKnown ? remainingPercent : undefined} aria-valuetext={quotaKnown ? 'Còn ' + remainingPercentLabel + ', ' + number(available) + ' trên ' + number(subscription?.aiLimit || 0) + ' lượt AI khả dụng' : 'Chưa xác định hạn mức'}><div className="ai-subscription-meter-remaining h-full rounded-full" style={{ width: (quotaKnown ? remainingPercent : 0) + '%' }} /></div>
                  <p className="text-xs tabular-nums text-on-surface-variant">{quotaKnown ? 'Tổng ' + number(subscription?.aiLimit || 0) + ' lượt' : 'Chờ cập nhật'}</p>
                </div>
              </div>}
            </section>
            <AiSubscriptionHistory enabled={loaded && view === 'usage'} refreshKey={historyKey} />
          </div>
          <div id="ai_subscription_plans" hidden={view !== 'plans'}><AiPlanCatalog subscription={currentSubscription} revision={revision} companyName={companyName} companyCode={companyCode} subscriptionReady={quotaKnown} mobileDock={mobileDock} /></div>
          {updatedAt && <p className="text-right text-xs leading-5 text-on-surface-variant">Cập nhật lúc {updatedAt.toLocaleTimeString('vi-VN')}</p>}
        </div>
      </div>
      <div ref={setMobileDock} hidden={view !== 'plans'} className="shrink-0 lg:hidden" />
    </div>
  );
}
