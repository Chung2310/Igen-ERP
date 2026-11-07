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

export type QuotationMoneyRow = {
  _id: string;
  quoteNumber: string;
  customerName: string;
  kind?: "customer" | "estimate";
  currency: string;
  total: number;
  totalUnknown?: boolean;
  createdAt: string;
};

const vietnamDate = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

export async function getQuotationMoneyRows(from: string, to: string, companyCode: string, branchId: string, expectedCount: number, signal?: AbortSignal): Promise<QuotationMoneyRow[]> {
  if (expectedCount === 0) return [];
  const readKind = async (kind: "customer" | "estimate") => {
    const rows = new Map<string, QuotationMoneyRow>();
    const fetchPage = async (page?: number) => withRequestTimeout(async requestSignal => {
      const query = new URLSearchParams({ companyCode });
      if (kind === "customer") query.set("kind", "customer");
      if (page !== undefined) query.set("page", String(page));
      const response = await fetch(`/api/v1/quotation/quotes?${query}`, {
        signal: requestSignal,
        headers: { Authorization: `Bearer ${getAccessToken()}`, "x-branch-id": branchId },
      });
      if (!response.ok) throw new Error("Không thể tải chi tiết giá trị báo giá.");
      const data = await response.json() as { quotes?: QuotationMoneyRow[]; page?: number };
      if (!Array.isArray(data.quotes)) throw new Error("Dữ liệu chi tiết báo giá không hợp lệ.");
      return data;
    }, 20000, "Tải chi tiết giá trị báo giá quá lâu. Vui lòng thử lại.", signal);

    const addRows = (quotes: QuotationMoneyRow[]) => {
      for (const quote of quotes) {
        const day = vietnamDate(quote.createdAt);
        if (day >= from && day <= to) rows.set(quote._id, quote);
      }
    };
    const first = await fetchPage();
    addRows(first.quotes!);
    if (first.quotes!.length < 100 || vietnamDate(first.quotes![first.quotes!.length - 1].createdAt) < from) return [...rows.values()];
    // Trang 12 bắt đầu từ chứng từ thứ 100; Map loại phần giao nhau với 100 bản ghi đầu.
    for (let page = 12; page <= 500; page += 1) {
      const result = await fetchPage(page);
      if (result.page !== page || !result.quotes?.length) return [...rows.values()];
      addRows(result.quotes);
      if (result.quotes.length < 9 || vietnamDate(result.quotes[result.quotes.length - 1].createdAt) < from) return [...rows.values()];
    }
    throw new Error("Kỳ này có quá nhiều báo giá để thống kê chi tiết. Hãy chọn kỳ ngắn hơn.");
  };
  const rows = (await Promise.all([readKind("customer"), readKind("estimate")])).flat();
  if (rows.length !== expectedCount) throw new Error("Danh sách báo giá đã thay đổi. Vui lòng tải lại để xem thống kê tiền chính xác.");
  return rows;
}
