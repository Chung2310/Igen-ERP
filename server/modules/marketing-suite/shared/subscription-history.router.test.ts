import { beforeEach, expect, test, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
const history = vi.hoisted(() => vi.fn());
vi.mock('./service/ai-subscription-history.service', () => ({ getSubscriptionHistory: history }));
vi.mock('./service/ai-subscription.service', () => ({ aiSubscriptionService: {} }));
vi.mock('./model/ai-subscription.model', () => ({ AiSubscriptionPlanModel: {}, AiUsageModel: {} }));
import { subscriptionRouter } from './subscription.router';

beforeEach(() => { vi.resetAllMocks(); history.mockResolvedValue({ items: [], page: 1, totalPages: 1 }); });
async function request(query: Record<string, unknown>, companyCode?: string) {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const handler = subscriptionRouter.stack.find(layer => layer.route?.path === '/history')?.route?.stack[0]?.handle;
  if (!handler) throw new Error('Missing history route');
  await handler({ query, user: companyCode ? { companyCode } : undefined } as AuthenticatedRequest, response as unknown as Response, vi.fn());
  return response;
}
test('ignores caller-supplied tenant scope and uses the authenticated company', async () => {
  await request({ page: '2', companyCode: 'OTHER' }, ' qa ');
  expect(history).toHaveBeenCalledWith('QA', 2);
});
test.each(['0', '-1', '1.5', '1000000', ['1', '2']])('rejects invalid page values: %j', async page => {
  const response = await request({ page }, 'QA');
  expect(response.status).toHaveBeenCalledWith(400); expect(history).not.toHaveBeenCalled();
});
test('requires a company scope even when the router is invoked without its parent guard', async () => {
  const response = await request({});
  expect(response.status).toHaveBeenCalledWith(403); expect(history).not.toHaveBeenCalled();
});
