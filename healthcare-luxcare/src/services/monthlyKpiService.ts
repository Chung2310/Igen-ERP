import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
export type MonthlyKpiRow = {
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percent: number | null;
};
export type MonthlyKpiReport = {
  periodKey: string;
  periodStatus: "provisional" | "closed";
  closedAt: string | null;
  timezone?: string;
  rows: MonthlyKpiRow[];
};
/** KPI periods follow Vietnam time, independently of the device timezone. */
export function currentKpiPeriod(now = new Date()) {
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${vietnam.getUTCFullYear()}-${String(vietnam.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function validateKpiPeriod(period: string, now = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Vui lòng nhập tháng theo định dạng YYYY-MM.");
  if (period > currentKpiPeriod(now)) throw new Error("Không thể xem KPI của tháng trong tương lai.");
  return period;
}
export function createMonthlyKpiService({ fetch, getAccessToken }: ServiceTransport) {
  return {
    report: async (period: string, branchId?: string): Promise<MonthlyKpiReport> => {
      validateKpiPeriod(period);
      const query = new URLSearchParams({ period });
      if (branchId) query.set("branchId", branchId);
      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`/api/v1/kanban/kpi/monthly?${query}`, { headers });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const { data } = await response.json();
      if (!data || !Array.isArray(data.rows) || data.periodKey !== period)
        throw new Error("Báo cáo KPI trả về không hợp lệ.");
      return data;
    },
  };
}
export const monthlyKpiService = createMonthlyKpiService(browserTransport);
