import { getAccessToken } from "./authService";
import { DashboardSummary, DashboardDateFilter, DashboardActionItems } from "../types/dashboard";
import { withRequestTimeout } from '../utils/requestTimeout';
import type { BusinessOverview } from '../../shared/business-overview';

export interface DashboardSummaryParams {
  filter: DashboardDateFilter;
  startDate?: string;
  endDate?: string;
}

export const dashboardService = {
  async getBusinessOverview(from: string, to: string, options: { signal?: AbortSignal; branchId?: string } = {}): Promise<BusinessOverview> {
    return withRequestTimeout(async signal => {
      const qs = new URLSearchParams({ filter: 'custom', startDate: from, endDate: to });
      const response = await fetch(`/api/v1/dashboard/business-overview?${qs}`, {
        signal,
        headers: { Authorization: `Bearer ${getAccessToken()}`, ...(options.branchId ? { 'x-branch-id': options.branchId } : {}) },
      });
      if (!response.ok) throw new Error('Không thể tải tổng quan doanh nghiệp. Vui lòng thử lại.');
      const body = await response.json() as { data?: BusinessOverview };
      if (!body.data?.access || !Array.isArray(body.data.errors)) throw new Error('Dữ liệu tổng quan không hợp lệ. Vui lòng thử lại.');
      return body.data;
    }, 20000, 'Tải tổng quan quá lâu. Vui lòng thử lại.', options.signal);
  },
  /**
   * Lấy số liệu tổng hợp tất cả module cho trang tổng quan trong một request.
   */
  async getSummary(params: DashboardSummaryParams, options: { signal?: AbortSignal; branchId?: string } = {}): Promise<DashboardSummary> {
    return withRequestTimeout(async (signal) => {
    const qs = new URLSearchParams({ filter: params.filter });
    if (params.filter === "custom" && params.startDate && params.endDate) {
      qs.set("startDate", params.startDate);
      qs.set("endDate", params.endDate);
    }

    const res = await fetch(`/api/v1/dashboard/summary?${qs.toString()}`, {
      signal,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        ...(options.branchId ? { 'x-branch-id': options.branchId } : {}),
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải dữ liệu tổng quan.");
    }

    const json = await res.json();
    return json.data as DashboardSummary;
    }, 20000, 'Tải tổng quan quá lâu. Vui lòng thử lại.', options.signal);
  },

  /**
   * Lấy danh sách "Việc cần xử lý hôm nay" (task quá hạn, phiếu chờ duyệt, tồn kho thấp).
   */
  async getActionItems(): Promise<DashboardActionItems> {
    const res = await fetch("/api/v1/dashboard/action-items", {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải việc cần xử lý hôm nay.");
    }

    const json = await res.json();
    return json.data as DashboardActionItems;
  },
};
