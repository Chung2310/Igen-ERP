import { getAccessToken } from "../../services/authService";
import { withRequestTimeout } from "../../utils/requestTimeout";

export type QuotationOverview = {
  from: string;
  to: string;
  quotes: {
    total: number;
    byStatus: { draft: number; needs_info: number; pending_review: number; approved: number; rejected: number };
    byKind: { customer: number; estimate: number };
    values: Array<{ currency: string; customer: number; estimate: number; approvedCustomer: number; approvedEstimate: number }>;
    trend: Array<{ date: string; count: number; approved: number }>;
    customers: Array<{ name: string; count: number }>;
    products: Array<{ name: string; quantity: number }>;
  };
  contracts: { total: number; draft: number; signed: number } | null;
  acceptances: { total: number; draft: number; completed: number } | null;
};

export async function getQuotationOverview(from: string, to: string, companyCode: string, branchId: string, signal?: AbortSignal): Promise<QuotationOverview> {
  return withRequestTimeout(async requestSignal => {
    const query = new URLSearchParams({ from, to, companyCode });
    const response = await fetch(`/api/v1/quotation/overview?${query}`, {
      signal: requestSignal,
      headers: { Authorization: `Bearer ${getAccessToken()}`, "x-branch-id": branchId },
    });
    if (!response.ok) throw new Error("Không thể tải thống kê Báo giá.");
    const result = await response.json() as QuotationOverview;
    if (!result.quotes || !Array.isArray(result.quotes.trend) || !Array.isArray(result.quotes.values)) throw new Error("Dữ liệu thống kê Báo giá không hợp lệ.");
    return result;
  }, 20000, "Tải thống kê Báo giá quá lâu. Vui lòng thử lại.", signal);
}
