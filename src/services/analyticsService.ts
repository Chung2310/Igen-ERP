import { getAccessToken } from "./authService";

export interface RevenueSourceStatus {
  key: "tuition" | "goods";
  label: string;
  available: boolean;
  blockedReason?: string;
  excludedRecords?: number;
}

export interface AnalyticsMeta {
  sources: RevenueSourceStatus[];
  grossProfitAvailable: boolean;
  currency: string;
}

export type RevenueGranularity = "day" | "week" | "month";

export interface RevenueBucket {
  bucket: string;
  amount: number;
  count: number;
  tuitionAmount: number;
  tuitionCount: number;
  goodsAmount: number;
  goodsCount: number;
}

export interface RevenueReport {
  range: { from: string; to: string; granularity: RevenueGranularity };
  total: number;
  tuitionTotal: number;
  goodsTotal: number;
  previousTotal: number;
  /** null khi không có kỳ trước để so — khác với 0% (không tăng trưởng) */
  growthPct: number | null;
  series: RevenueBucket[];
  excludedRecords: number;
  excludedGoodsLines: number;
  excludedCostLines: number;
  excludedUnclassifiedStockOut: number;
  goodsGrossProfit: number | null;
  goodsBreakdown: Array<{
    category: string;
    revenue: number;
    grossProfit: number | null;
    quantity: number;
  }>;
  currency: string;
}

export interface ReceivablesReport {
  asOf: string;
  total: number;
  count: number;
  aging: Array<{ bucket: "notSent" | "0-30" | "31-60" | "60+"; amount: number; count: number }>;
  agingBasis: "sentAt";
  currency: string;
}

export interface ExpensesReport {
  range: { from: string; to: string };
  total: number;
  payroll: { amount: number; count: number };
  commission: { amount: number; count: number };
  excludedCommissionRecords: number;
  currency: string;
}

export interface ProfitAndLossReport {
  revenue: number;
  tuitionRevenue: number;
  goodsRevenue: number;
  goodsGrossProfit: number | null;
  payrollExpense: number;
  commissionExpense: number;
  totalOperatingExpenses: number;
  operatingResult: number | null;
  excludedCostLines: number;
  excludedCommissionRecords: number;
  currency: string;
}

async function getAnalyticsJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) throw new Error("Không thể tải dữ liệu phân tích.");
  const json = await res.json();
  return json.data as T;
}

export const analyticsService = {
  /** Doanh thu học phí theo thời gian, kèm tổng kỳ liền trước để so sánh. */
  async getRevenue(params: {
    from: string;
    to: string;
    granularity: RevenueGranularity;
  }): Promise<RevenueReport> {
    const qs = new URLSearchParams(params);

    const res = await fetch(`/api/v1/analytics/revenue?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải dữ liệu doanh thu.");
    }

    const json = await res.json();
    return json.data as RevenueReport;
  },

  /**
   * Tình trạng sẵn sàng của từng nguồn doanh thu — dùng để quyết định khối nào
   * được vẽ, khối nào hiện lý do chưa có dữ liệu.
   */
  async getMeta(): Promise<AnalyticsMeta> {
    const res = await fetch("/api/v1/analytics/meta", {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải tình trạng dữ liệu báo cáo.");
    }

    const json = await res.json();
    return json.data as AnalyticsMeta;
  },

  getReceivables(asOf: string): Promise<ReceivablesReport> {
    return getAnalyticsJson(`/api/v1/analytics/receivables?${new URLSearchParams({ asOf })}`);
  },

  getExpenses(params: { from: string; to: string }): Promise<ExpensesReport> {
    return getAnalyticsJson(`/api/v1/analytics/expenses?${new URLSearchParams(params)}`);
  },

  getProfitAndLoss(params: { from: string; to: string; granularity: RevenueGranularity }): Promise<ProfitAndLossReport> {
    return getAnalyticsJson(`/api/v1/analytics/pnl?${new URLSearchParams(params)}`);
  },
};
