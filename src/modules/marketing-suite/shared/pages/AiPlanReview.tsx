import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CreditCard, Info, Layers3 } from 'lucide-react';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { formatAiPlanPrice, type AiSubscriptionPlan, type AiSubscriptionSummary } from '../../../../services/aiSubscriptionService';

const number = (value: number) => value.toLocaleString('vi-VN');

export default function AiPlanReview({ plan, subscription, companyName, companyCode, subscriptionReady = true, mobileDock }: {
  plan: AiSubscriptionPlan | null; subscription: AiSubscriptionSummary | null; companyName?: string; companyCode?: string;
  subscriptionReady?: boolean; mobileDock: HTMLElement | null;
}) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const id = useId();
  const [paymentNotice, setPaymentNotice] = useState(false);
  const carryAvailable = subscription?.status === 'active' ? subscription.remaining : 0;
  const hasPrice = plan != null && typeof plan.priceVnd === 'number' && Number.isSafeInteger(plan.priceVnd) && plan.priceVnd >= 0;

  if (!plan) return desktop ? <aside className="ai-subscription-panel ai-plan-summary p-5" aria-labelledby={id + '_title'}>
    <h2 id={id + '_title'} className="flex items-center gap-2 text-balance text-base font-semibold"><CreditCard className="size-4 text-primary" aria-hidden="true" />Tóm tắt thanh toán</h2>
    <div className="py-10 text-center"><Layers3 className="mx-auto size-8 text-on-surface-variant" aria-hidden="true" /><p className="mt-3 text-sm font-medium">Chưa chọn gói</p></div>
  </aside> : null;

  const detail = <div className="space-y-4">
    <dl className="space-y-3 text-sm">
      <div className="ai-plan-order-row"><dt>Lượt AI</dt><dd>{number(plan.aiLimit)}</dd></div>
      <div className="ai-plan-order-row"><dt>Thời hạn</dt><dd>{number(plan.durationDays)} ngày</dd></div>
      <div className="ai-plan-order-row"><dt>Lượt dư còn hạn</dt><dd>{subscriptionReady ? '+ ' + number(carryAvailable) : 'Chưa xác định'}</dd></div>
    </dl>
    <div className="rounded-xl bg-primary/5 p-4"><p className="text-xs text-on-surface-variant">Dự kiến sau nâng cấp</p><p className="mt-1 text-2xl font-semibold tabular-nums">{subscriptionReady ? number(plan.aiLimit + carryAvailable) : '—'} <span className="text-sm font-normal text-on-surface-variant">lượt AI</span></p></div>
    <details className="text-sm"><summary className="ai-plan-details-summary flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg font-medium focus-visible:outline-2 focus-visible:outline-primary">Chi tiết gói<ChevronDown className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /></summary>
      {plan.description && <p className="mb-3 whitespace-pre-line break-words text-pretty text-sm leading-6 text-on-surface-variant">{plan.description}</p>}
      <ul className="space-y-2 text-xs leading-5 text-on-surface-variant">{[
        'Kỳ mới tính từ lúc kích hoạt.',
        'Cộng lượt dư còn hạn. Dùng chung doanh nghiệp.',
      ].map(text => <li key={text} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" /><span>{text}</span></li>)}</ul>
    </details>
  </div>;
  const payment = <div className="space-y-2">
    <button type="button" disabled={!hasPrice} aria-describedby={id + '_availability'} onClick={() => setPaymentNotice(true)} className="ai-subscription-primary w-full"><CreditCard className="size-4" aria-hidden="true" />Thanh toán</button>
    <p id={id + '_availability'} className="flex items-start gap-1.5 text-pretty text-xs leading-5 text-on-surface-variant"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{hasPrice ? 'Thanh toán chưa khả dụng.' : 'Gói chưa được thiết lập giá.'}</p>
    {paymentNotice && <p role="status" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-pretty text-xs leading-5 text-on-surface-variant">Chưa phát sinh giao dịch.</p>}
  </div>;

  if (!desktop) return mobileDock ? createPortal(<section className="ai-plan-mobile-checkout" aria-label="Tóm tắt thanh toán">
    <details className="ai-plan-mobile-detail">
      <summary className="ai-plan-details-summary flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{plan.name}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">Xem chi tiết<ChevronDown className="size-3" aria-hidden="true" /></span></span>
        <span className="shrink-0 text-right"><span className="block text-xs text-on-surface-variant">Tổng thanh toán</span><span className="block text-lg font-semibold tabular-nums">{formatAiPlanPrice(plan.priceVnd)}</span></span>
      </summary>
      <div className="max-h-64 overflow-y-auto border-t border-outline-variant py-4">{detail}</div>
    </details>
    <div className="mt-2">{payment}</div>
  </section>, mobileDock) : null;

  return <aside className="ai-subscription-panel ai-plan-summary p-5" aria-labelledby={id + '_title'}>
    <h2 id={id + '_title'} className="flex items-center gap-2 text-balance text-base font-semibold"><CreditCard className="size-4 text-primary" aria-hidden="true" />Tóm tắt thanh toán</h2>
    <div className="my-5 border-y border-outline-variant py-4"><h3 className="break-words text-balance text-lg font-semibold">{plan.name}</h3><p className="mt-1 break-words text-xs text-on-surface-variant">{companyName || companyCode || 'Doanh nghiệp của bạn'}</p></div>
    {detail}
    <div className="my-4 border-t border-outline-variant pt-4"><p className="text-sm text-on-surface-variant">Tổng thanh toán</p><p className="mt-1 break-words text-3xl font-semibold tabular-nums">{formatAiPlanPrice(plan.priceVnd)}</p></div>
    {payment}
  </aside>;
}
