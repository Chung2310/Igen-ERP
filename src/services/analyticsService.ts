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

export const analyticsService = {
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
