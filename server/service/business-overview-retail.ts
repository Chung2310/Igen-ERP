import type { BusinessOverview } from '../../shared/business-overview';
import { businessDateKey, parseBusinessDate } from '../../shared/business-calendar';
import { RetailOrderModel } from '../modules/retail/models/retail-order.model';
import { createRetailReportService } from '../modules/retail/services/retail-report.service';
import type { DashboardRange } from './dashboard.service';

// Reuse the POS report's discounts/refunds/product calculations, without loading shift reports or profit.
const reports = createRetailReportService({
  loadOrders: pipeline => RetailOrderModel.aggregate(pipeline),
  loadShifts: async () => [],
});

export async function getRetailBusinessOverview(scope: { companyCode: string; branchId?: string }, range: DashboardRange): Promise<NonNullable<BusinessOverview['retail']>> {
  const duration = range.end.getTime() - range.start.getTime() + 1;
  const today = businessDateKey(new Date());
  const yesterday = businessDateKey(new Date(parseBusinessDate(today)!.getTime() - 86400000));
  const [current, previous, daily] = await Promise.all([
    reports.summary(scope, { from: businessDateKey(range.start), to: businessDateKey(range.end) }, false),
    reports.summary(scope, { from: businessDateKey(new Date(range.start.getTime() - duration)), to: businessDateKey(new Date(range.start.getTime() - 1)) }, false),
    reports.summary(scope, { from: yesterday, to: today }, false),
  ]);
  return {
    todaySales: daily.timeSeries.find(row => row.businessDate === today)?.netSales || 0,
    yesterdaySales: daily.timeSeries.find(row => row.businessDate === yesterday)?.netSales || 0,
    netSales: current.summary.netSales, previousSales: previous.summary.netSales, orderCount: current.summary.orderCount, refunds: current.summary.refunds,
    series: current.timeSeries.map(row => ({ date: row.businessDate, value: row.netSales })),
    products: current.products.map(row => ({ productId: row.productId, sku: row.sku, productName: row.productName, netSales: row.netSales })),
  };
}
