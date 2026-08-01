import { StockLogModel } from "../model/stock-log.model";

export interface AnalyticsScope {
  companyCode?: string;
}

/** Một nguồn doanh thu và tình trạng sẵn sàng của nó */
export interface RevenueSourceStatus {
  key: "tuition" | "goods";
  label: string;
  /** Có đủ dữ liệu để hiển thị số liệu hay chưa */
  available: boolean;
  /** Lý do chưa dùng được — hiển thị thẳng cho admin, không giấu */
  blockedReason?: string;
  /** Số bản ghi bị loại khỏi báo cáo vì thiếu dữ liệu */
  excludedRecords?: number;
}

export const analyticsService = {
  /**
   * Tình trạng sẵn sàng của từng nguồn doanh thu.
   *
   * Doanh thu học phí (`Payment.amount`) dùng được ngay. Doanh thu kho phụ thuộc
   * hai trường chưa tồn tại trong schema (`items[].unitPrice` snapshot và
   * `purpose` để tách bán hàng khỏi xuất nội bộ) — xem docs/admin-analytics/research.md
   * mục 2.1. Trước khi có chúng, số liệu kho bị chặn có chủ đích thay vì tính từ
   * `Product.price` hiện tại, vì làm vậy khiến doanh thu quá khứ thay đổi mỗi lần
   * ai đó sửa giá bán.
   */
  async getMeta(scope: AnalyticsScope) {
    const stockQuery = scope.companyCode ? { companyCode: scope.companyCode } : {};

    const [stockOutTotal, stockOutPriced] = await Promise.all([
      StockLogModel.countDocuments({ ...stockQuery, type: "xuất" }),
      StockLogModel.countDocuments({
        ...stockQuery,
        type: "xuất",
        "items.unitPrice": { $exists: true },
      }),
    ]);

    const goodsReady = stockOutTotal > 0 && stockOutPriced === stockOutTotal;

    const sources: RevenueSourceStatus[] = [
      {
        key: "tuition",
        label: "Học phí / lao động",
        available: true,
      },
      {
        key: "goods",
        label: "Bán hàng từ kho",
        available: goodsReady,
        blockedReason: goodsReady
          ? undefined
          : "Phiếu xuất kho chưa lưu đơn giá tại thời điểm xuất và chưa phân loại mục đích xuất (bán / nội bộ / hủy / chuyển kho).",
        excludedRecords: stockOutTotal - stockOutPriced,
      },
    ];

    return {
      sources,
      /** Lãi gộp cần giá vốn (`Product.costPrice`) — chưa có trong schema */
      grossProfitAvailable: false,
      currency: "VND",
    };
  },
};
