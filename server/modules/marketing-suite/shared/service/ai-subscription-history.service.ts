import type { AiSubscriptionHistory, AiSubscriptionHistoryEvent } from '../../../../../shared/marketing-suite/subscription';
import { AiSubscriptionPeriodModel } from '../model/ai-subscription.model';

const periodsPerPage = 10;
type Period = { _id: { toString(): string }; planName: string; aiLimit: number; carriedOver?: number; priceVnd?: number | null; startsAt: Date; expiresAt: Date; status: string };

// The preceding (newer) period tells us whether an old package was replaced before expiry.
export function buildSubscriptionHistory(periods: Period[], skipNeighbor: boolean, now: Date): AiSubscriptionHistoryEvent[] {
  const items: AiSubscriptionHistoryEvent[] = [];
  for (let index = skipNeighbor ? 1 : 0; index < periods.length; index++) {
    const period = periods[index];
    const id = String(period._id);
    items.push({ id: id + ':purchase', type: 'purchase', occurredAt: period.startsAt.toISOString(), planName: period.planName,
      aiUnits: Math.max(0, period.aiLimit - (period.carriedOver || 0)), priceVnd: period.priceVnd ?? null });
    const newer = periods[index - 1];
    const naturallyExpired = period.expiresAt <= now && (period.status === 'active'
      || (period.status === 'replaced' && newer && newer.startsAt >= period.expiresAt));
    if (naturallyExpired) items.push({ id: id + ':expired', type: 'expired', occurredAt: period.expiresAt.toISOString(), planName: period.planName, aiUnits: null, priceVnd: null });
  }
  return items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
}

export async function getSubscriptionHistory(companyCode: string, requestedPage = 1): Promise<AiSubscriptionHistory> {
  const scope = { companyCode: companyCode.trim().toUpperCase() };
  const total = await AiSubscriptionPeriodModel.countDocuments(scope);
  const totalPages = Math.max(1, Math.ceil(total / periodsPerPage));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * periodsPerPage;
  const skipNeighbor = offset > 0;
  const periods = await AiSubscriptionPeriodModel.find(scope)
    .select('_id planName aiLimit carriedOver priceVnd startsAt expiresAt status')
    .sort({ startsAt: -1, _id: -1 }).skip(Math.max(0, offset - 1)).limit(periodsPerPage + Number(skipNeighbor)).lean();
  return { items: buildSubscriptionHistory(periods, skipNeighbor, new Date()), page, totalPages };
}
