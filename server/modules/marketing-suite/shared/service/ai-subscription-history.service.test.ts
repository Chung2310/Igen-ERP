import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ count: vi.fn(), find: vi.fn(), query: { select: vi.fn(), sort: vi.fn(), skip: vi.fn(), limit: vi.fn(), lean: vi.fn() } }));
vi.mock('../model/ai-subscription.model', () => ({ AiSubscriptionPeriodModel: { countDocuments: mocks.count, find: mocks.find } }));
import { buildSubscriptionHistory, getSubscriptionHistory } from './ai-subscription-history.service';

const now = new Date('2026-10-29T00:00:00Z');
const period = (id: string, start: string, expiry: string, status = 'active') => ({ _id: id, planName: id, aiLimit: 1400, carriedOver: 400, priceVnd: 99000, startsAt: new Date(start), expiresAt: new Date(expiry), status });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.count.mockResolvedValue(1); mocks.find.mockReturnValue(mocks.query);
  for (const method of [mocks.query.select, mocks.query.sort, mocks.query.skip, mocks.query.limit]) method.mockReturnValue(mocks.query);
  mocks.query.lean.mockResolvedValue([]);
});

test('records package purchases separately from expiry and excludes carried-over units from purchased quota', () => {
  const events = buildSubscriptionHistory([period('one', '2026-01-01', '2026-02-01')], false, now);
  expect(events.map(event => event.type)).toEqual(['expired', 'purchase']);
  expect(events[1]).toMatchObject({ aiUnits: 1000, priceVnd: 99000 });
  expect(events[0]).toMatchObject({ aiUnits: null, priceVnd: null, occurredAt: '2026-02-01T00:00:00.000Z' });
});
test('an early upgrade never produces a false expiration for the replaced package', () => {
  const events = buildSubscriptionHistory([period('new', '2026-02-01', '2027-02-01'), period('old', '2026-01-01', '2026-03-01', 'replaced')], false, now);
  expect(events.map(event => event.id)).toEqual(['new:purchase', 'old:purchase']);
});
test('a package that expired before renewal keeps its real expiry event', () => {
  const events = buildSubscriptionHistory([period('new', '2026-03-01', '2027-03-01'), period('old', '2026-01-01', '2026-02-01', 'replaced')], false, now);
  expect(events.map(event => event.id)).toEqual(['new:purchase', 'old:expired', 'old:purchase']);
});
test('cancelled packages and future expirations do not create expiration transactions', () => {
  const events = buildSubscriptionHistory([period('future', '2026-01-01', '2027-01-01'), period('cancelled', '2025-01-01', '2025-02-01', 'cancelled')], false, now);
  expect(events.every(event => event.type === 'purchase')).toBe(true);
});
test('pagination fetches one newer neighbor and queries only the authenticated company', async () => {
  mocks.count.mockResolvedValue(21);
  mocks.query.lean.mockResolvedValue([period('neighbor', '2026-02-01', '2027-02-01'), period('old', '2026-01-01', '2026-03-01', 'replaced')]);
  const result = await getSubscriptionHistory(' qa ', 2);
  expect(mocks.count).toHaveBeenCalledWith({ companyCode: 'QA' });
  expect(mocks.find).toHaveBeenCalledWith({ companyCode: 'QA' });
  expect(mocks.query.skip).toHaveBeenCalledWith(9); expect(mocks.query.limit).toHaveBeenCalledWith(11);
  expect(result).toMatchObject({ page: 2, totalPages: 3 });
  expect(result.items.map(item => item.id)).toEqual(['old:purchase']);
});
