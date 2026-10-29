import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, Check, CheckCircle2, Layers3, RefreshCw } from 'lucide-react';
import { getAvailableAiSubscriptionPlans, formatAiPlanPrice, type AiSubscriptionPlan, type AiSubscriptionSummary } from '../../../../services/aiSubscriptionService';
import { cn } from '../../../student-management/lib/utils';
import AiPlanReview from './AiPlanReview';

const number = (value: number) => value.toLocaleString('vi-VN');
const duration = (days: number) => number(days) + ' ngày';

export default function AiPlanCatalog({ subscription, revision, companyName, companyCode, subscriptionReady = true, mobileDock }: {
  subscription: AiSubscriptionSummary | null; revision: number; companyName?: string; companyCode?: string;
  subscriptionReady?: boolean; mobileDock: HTMLElement | null;
}) {
  const [plans, setPlans] = useState<AiSubscriptionPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const value = await getAvailableAiSubscriptionPlans(controller.signal);
        if (active) { setPlans(value); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách gói AI.');
      } finally {
        pending = false;
        if (active) setLoaded(true);
      }
    };
    const onRefresh = () => { void refresh(); };
    onRefresh();
    const timer = window.setInterval(onRefresh, 60_000);
    window.addEventListener('focus', onRefresh);
    document.addEventListener('visibilitychange', onRefresh);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', onRefresh);
      document.removeEventListener('visibilitychange', onRefresh);
    };
  }, [revision, retry]);

  const durations = [...new Set(plans.map(plan => plan.durationDays))].sort((a, b) => a - b);
  const activeDays = selectedDays !== null && durations.includes(selectedDays) ? selectedDays : null;
  const visiblePlans = activeDays === null ? plans : plans.filter(plan => plan.durationDays === activeDays);
  const selectedPlan = plans.find(plan => plan._id === selectedId) || null;
  const activeSubscription = subscription?.status === 'active';
  const currentAvailable = activeSubscription ? subscription.remaining : 0;
  const requestRetry = () => { setError(''); setRetry(value => value + 1); };

  return <section className="space-y-4" aria-labelledby="ai_plan_catalog_title" aria-busy={!loaded}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="ai_plan_catalog_title" className="text-balance text-base font-semibold">Chọn gói</h2>
      {loaded && durations.length > 1 && <div className="ai-plan-filters" role="group" aria-label="Lọc gói theo thời hạn">
        {[null, ...durations].map(days => <button key={days ?? 'all'} type="button" aria-pressed={activeDays === days} onClick={() => setSelectedDays(days)} className={cn('ai-plan-duration', activeDays === days && 'ai-plan-duration-active')}>{days === null ? 'Tất cả' : duration(days)}</button>)}
      </div>}
    </div>
    {selectedId && loaded && !selectedPlan && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-pretty text-sm text-on-surface-variant">Gói đã chọn không còn được cung cấp. Vui lòng chọn lại gói khác.</p>}
    {error && <div role="alert" className="ai-subscription-notice flex items-start gap-3 rounded-xl border p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0"><p className="text-pretty text-sm leading-6">{error} {plans.length ? 'Danh sách đang hiển thị là lần cập nhật gần nhất.' : ''}</p><button type="button" onClick={requestRetry} className="ai-subscription-back mt-1"><RefreshCw className="size-4" aria-hidden="true" />Tải lại danh sách</button></div>
    </div>}
    {!loaded ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Đang tải danh sách gói AI">
      {[0, 1, 2].map(item => <div key={item} aria-hidden="true" className="ai-subscription-panel space-y-5 p-5"><div className="ai-subscription-skeleton h-5 w-1/2 rounded-lg" /><div className="ai-subscription-skeleton h-10 w-2/3 rounded-lg" /><div className="ai-subscription-skeleton h-20 rounded-xl" /></div>)}
      <span className="sr-only">Đang tải danh sách gói AI…</span>
    </div> : plans.length ? <div className="ai-plan-layout">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-on-surface-variant">
          <p className="min-w-0 break-words">{activeSubscription ? 'Đang dùng: ' : 'Gói gần nhất: '}<strong className="font-medium text-on-surface">{subscriptionReady ? subscription?.planName || 'Chưa có gói' : 'Chưa cập nhật'}</strong></p>
          <p>Còn <strong className="font-medium tabular-nums text-on-surface">{subscriptionReady ? number(currentAvailable) : '—'}</strong> lượt khả dụng</p>
        </div>
        <div className="grid min-w-0 items-stretch gap-3 sm:grid-cols-2">
          {visiblePlans.map(plan => {
            const samePlan = subscription?.planId === plan._id;
            const current = activeSubscription && samePlan;
            const selected = selectedId === plan._id;
            return <article key={plan._id} className={cn('ai-subscription-panel ai-plan-card flex min-w-0 flex-col p-5', selected && 'ai-plan-card-selected')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 break-words text-balance text-lg font-semibold">{plan.name}</h3>
                {current && <span className="ai-subscription-badge"><CheckCircle2 className="size-3.5" aria-hidden="true" />Đang dùng</span>}
              </div>
              <div className="my-4 flex flex-wrap items-end justify-between gap-3 border-y border-outline-variant py-4">
                <div><p className="break-words text-3xl font-semibold tabular-nums">{number(plan.aiLimit)}</p><p className="mt-1 text-xs text-on-surface-variant">lượt AI</p></div>
                <div className="text-right"><p className="text-xl font-semibold tabular-nums">{formatAiPlanPrice(plan.priceVnd)}</p><p className="mt-1 flex items-center justify-end gap-1 text-xs tabular-nums text-on-surface-variant"><CalendarDays className="size-3.5" aria-hidden="true" />{duration(plan.durationDays)}</p></div>
              </div>
              <button type="button" aria-label={(samePlan ? 'Chọn gia hạn ' : 'Chọn ') + plan.name} aria-pressed={selected} onClick={() => setSelectedId(plan._id)} className={cn('ai-plan-select mt-auto w-full', selected && 'ai-plan-select-active')}>{selected ? <><Check className="size-4" aria-hidden="true" />Đang chọn</> : samePlan ? 'Gia hạn gói' : 'Chọn gói này'}</button>
            </article>;
          })}
        </div>
      </div>
      <AiPlanReview key={selectedPlan ? selectedPlan._id + ':' + selectedPlan.updatedAt : 'unselected'} plan={selectedPlan} subscription={subscription} subscriptionReady={subscriptionReady} companyName={companyName} companyCode={companyCode} mobileDock={mobileDock} />
    </div> : !error && <div className="ai-subscription-panel flex flex-col items-center px-5 py-10 text-center">
      <Layers3 className="size-8 text-primary" aria-hidden="true" /><h3 className="mt-3 text-balance text-base font-semibold">Chưa có gói khả dụng</h3><button type="button" onClick={requestRetry} className="ai-subscription-back mt-3"><RefreshCw className="size-4" aria-hidden="true" />Tải lại</button>
    </div>}
  </section>;
}
