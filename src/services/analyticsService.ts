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
  filters: {
    branches: Array<{ id: string; code: string; name: string }>;
    courses: Array<{ id: string; code: string; name: string; branchId?: string }>;
    projects?: Array<{ id: string; code: string; name: string; branchId?: string }>;
  };
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
  aging: Array<{ bucket: "notScheduled" | "notDue" | "0-30" | "31-60" | "60+"; amount: number; count: number }>;
  agingBasis: "dueAt";
  currency: string;
}

export interface ExpensesReport {
  range: { from: string; to: string };
  total: number;
  payroll: { amount: number; count: number };
  commission: { amount: number; count: number };
  operating: { amount: number; count: number };
  operatingByCategory: Array<{ category: string; amount: number; count: number }>;
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
  generalOperatingExpense: number;
  totalOperatingExpenses: number;
  operatingResult: number | null;
  excludedCostLines: number;
  excludedCommissionRecords: number;
  currency: string;
}

export type AnalyticsExportReport = "overview" | "revenue" | "receivables" | "expenses" | "pnl";
export type AnalyticsExportFormat = "xlsx" | "csv";
export interface OperatingExpenseInput { category: string; description: string; amount: number; incurredOn: string; branchId?: string; projectId?: string }

/** Bản ghi chi phí vận hành đã lưu — dùng cho danh sách và form sửa. */
export interface OperatingExpense {
  _id: string;
  category: string;
  description: string;
  amount: number;
  incurredOn: string;
  branchId?: string;
  projectId?: string;
  status: string;
}

export type OperatingExpenseUpdate = Partial<Omit<OperatingExpenseInput, "branchId">>;

async function getAnalyticsJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) throw new Error("Không thể tải dữ liệu phân tích.");
  const json = await res.json();
  return json.data as T;
}

export const analyticsService = {
  async createOperatingExpense(input: OperatingExpenseInput): Promise<void> {
    const res = await fetch("/api/v1/analytics/operating-expenses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error("Không thể ghi nhận chi phí vận hành.");
  },
  /** Danh sách khoản chi vận hành trong khoảng thời gian, để xem và sửa. */
  async listOperatingExpenses(params: { from: string; to: string; branchId?: string; projectId?: string }): Promise<OperatingExpense[]> {
    const qs = new URLSearchParams(params as Record<string, string>);
    return getAnalyticsJson<OperatingExpense[]>(`/api/v1/analytics/operating-expenses?${qs.toString()}`);
  },
  async updateOperatingExpense(id: string, input: OperatingExpenseUpdate): Promise<void> {
    const res = await fetch(`/api/v1/analytics/operating-expenses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(input) });
    if (!res.ok) throw new Error("Không thể cập nhật khoản chi.");
  },
  async voidOperatingExpense(id: string): Promise<void> {
    const res = await fetch(`/api/v1/analytics/operating-expenses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!res.ok) throw new Error("Không thể hủy khoản chi.");
  },
  /** Doanh thu học phí theo thời gian, kèm tổng kỳ liền trước để so sánh. */
  async getRevenue(params: {
    from: string;
    to: string;
    granularity: RevenueGranularity;
    branchId?: string;
    courseId?: string;
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

  getReceivables(asOf: string, scope: { branchId?: string; courseId?: string } = {}): Promise<ReceivablesReport> {
    return getAnalyticsJson(`/api/v1/analytics/receivables?${new URLSearchParams({ asOf, ...scope })}`);
  },

  getExpenses(params: { from: string; to: string; branchId?: string; courseId?: string }): Promise<ExpensesReport> {
    return getAnalyticsJson(`/api/v1/analytics/expenses?${new URLSearchParams(params)}`);
  },

  getProfitAndLoss(params: { from: string; to: string; granularity: RevenueGranularity }): Promise<ProfitAndLossReport> {
    return getAnalyticsJson(`/api/v1/analytics/pnl?${new URLSearchParams(params)}`);
  },

  async downloadExport(params: {
    from: string;
    to: string;
    granularity: RevenueGranularity;
    report: AnalyticsExportReport;
    format: AnalyticsExportFormat;
    branchId?: string;
    courseId?: string;
  }): Promise<void> {
    const res = await fetch(`/api/v1/analytics/export?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.message || "Không thể xuất báo cáo.");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename=([^;]+)/i)?.[1]?.replace(/["']/g, "") || `analytics.${params.format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
