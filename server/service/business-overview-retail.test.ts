import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PipelineStage } from 'mongoose';
import { getRetailBusinessOverview } from './business-overview-retail';

const ordersDb = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock('../modules/retail/models/retail-order.model', () => ({ RetailOrderModel: ordersDb }));
vi.mock('./analytics.service', () => ({ analyticsService: {}, reconcileRetailAnalyticsRevenue: vi.fn() }));
const range = { start: new Date('2026-10-01T00:00:00+07:00'), end: new Date('2026-10-28T23:59:59.999+07:00'), filter: 'custom' };
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T08:00:00Z')); });
afterEach(() => vi.useRealTimers());

it('reuses POS net-sales/refund calculations, scopes all windows and excludes private profit/cost fields', async () => {
  const order = (day: string, total: number, refund: number, name: string, status = 'completed') => ({ orderCode: name + '-' + day, businessDate: day, grandTotal: total, refundedAmount: refund, totalCost: 100, dueAmount: 0, status, items: [{ productId: name, sku: name, productName: name, quantity: 1, unitCost: 100, lineTotal: total }] });
  const orders = [order('2026-10-28', 1000, 200, 'A'), order('2026-10-27', 600, 0, 'B'), order('2026-10-28', 900, 900, 'C', 'cancelled'), order('2026-09-20', 500, 0, 'A')];
  ordersDb.aggregate.mockImplementation(async (pipeline: PipelineStage[]) => {
    const query = (pipeline[0] as { $match: { companyCode: string; branchId: string; businessDate: { $gte: string; $lte: string } } }).$match;
    expect(query.companyCode).toBe('ACME'); expect(query.branchId).toBe('branch-a');
    return orders.filter(row => row.businessDate >= query.businessDate.$gte && row.businessDate <= query.businessDate.$lte);
  });
  const data = await getRetailBusinessOverview({ companyCode: 'ACME', branchId: 'branch-a' }, range);
  expect(data).toMatchObject({ todaySales: 800, yesterdaySales: 600, netSales: 1400, previousSales: 500, refunds: 1100, orderCount: 2 });
  expect(data.series.reduce((sum, point) => sum + point.value, 0)).toBe(1400);
  expect(data.products.map(row => row.productName).sort()).toEqual(['A', 'B']);
  expect(JSON.stringify(data)).not.toMatch(/unitCost|grossProfit|totalCost/);
});
