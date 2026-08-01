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
};
