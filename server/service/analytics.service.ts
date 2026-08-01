import { StockLogModel } from "../model/stock-log.model";
import { Payment } from "../modules/student-management/models/payment.model";
import { User } from "../modules/student-management/models/user.model";
import { buildCompanyUserFilter } from "../modules/student-management/utils/auth.util";

export interface AnalyticsScope {
  companyCode?: string;
}

export type RevenueGranularity = "day" | "week" | "month";

export interface RevenueRange {
  from: Date;
  to: Date;
  granularity: RevenueGranularity;
}

export interface RevenueBucket {
  bucket: string;
  amount: number;
  count: number;
  tuitionAmount: number;
  tuitionCount: number;
  goodsAmount: number;
  goodsCount: number;
}

export interface GoodsCategoryBreakdown {
  category: string;
  revenue: number;
  grossProfit: number | null;
  quantity: number;
}

/**
 * Tập ownerId được tính vào báo cáo.
 *
 * Cố tình KHÔNG dùng `getAllowedOwnerIds` của module học viên: hàm đó thu hẹp
 * theo `branchId` của chính người đang đăng nhập, nên một admin có gán chi nhánh
 * sẽ chỉ thấy doanh thu chi nhánh mình — trong khi trang này phải là báo cáo
 * toàn công ty. Ở đây phạm vi luôn là toàn bộ công ty; lọc theo chi nhánh là
 * lựa chọn hiển thị của admin, đưa vào sau qua tham số riêng.
 *
 * Trả `null` nghĩa là không giới hạn owner (superadmin không gắn công ty nào).
 */
async function resolveCompanyOwnerIds(companyCode?: string): Promise<string[] | null> {
  if (!companyCode) return null;

  const users = await User.find(buildCompanyUserFilter(companyCode)).select("_id").lean();
  const ids = users.map((user: any) => String(user._id));

  // companyCode cũng có thể là ownerId trực tiếp với dữ liệu cũ.
  return [...new Set([...ids, companyCode])];
}

/** Định dạng nhóm thời gian. Dùng UTC vì paidOn lưu mốc 00:00 UTC của ngày nghiệp vụ. */
const BUCKET_FORMAT: Record<RevenueGranularity, string> = {
  day: "%Y-%m-%d",
  week: "%G-W%V",
  month: "%Y-%m",
};

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
   * Doanh thu học phí theo thời gian, kèm tổng của kỳ liền trước để tính tăng trưởng.
   *
   * Gom nhóm theo `paidOn` chứ không phải `date` — xem
   * modules/student-management/utils/payment-date.util.ts để biết vì sao.
   * Giao dịch chưa có `paidOn` không thể xếp vào kỳ nào nên bị loại, và số lượng
   * bị loại được trả về để UI nói rõ thay vì im lặng làm thiếu doanh thu.
   */
  async getTuitionRevenue(scope: AnalyticsScope, range: RevenueRange) {
    const ownerIds = await resolveCompanyOwnerIds(scope.companyCode);
    const ownerMatch = ownerIds ? { ownerId: { $in: ownerIds } } : {};

    // Kỳ liền trước có cùng độ dài, kết thúc ngay tại thời điểm kỳ hiện tại bắt đầu.
    const spanMs = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - spanMs);

    const [buckets, previousAgg, excludedCount] = await Promise.all([
      Payment.aggregate([
        { $match: { ...ownerMatch, paidOn: { $gte: range.from, $lte: range.to } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: BUCKET_FORMAT[range.granularity],
                date: "$paidOn",
                timezone: "UTC",
              },
            },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { ...ownerMatch, paidOn: { $gte: previousFrom, $lt: range.from } } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ ...ownerMatch, paidOn: { $in: [null, undefined] } }),
    ]);

    const series: RevenueBucket[] = buckets.map((row: any) => ({
      bucket: row._id,
      amount: row.amount || 0,
      count: row.count || 0,
      tuitionAmount: row.amount || 0,
      tuitionCount: row.count || 0,
      goodsAmount: 0,
      goodsCount: 0,
    }));

    const total = series.reduce((sum, row) => sum + row.amount, 0);
    const previousTotal = previousAgg[0]?.amount || 0;

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        granularity: range.granularity,
      },
      total,
      previousTotal,
      // Không có kỳ trước để so thì trả null, không trả 0% (đọc nhầm thành "không tăng trưởng").
      growthPct:
        previousTotal > 0 ? Number((((total - previousTotal) / previousTotal) * 100).toFixed(1)) : null,
      series,
      /** Giao dịch không xác định được ngày nên không nằm trong bất kỳ kỳ nào */
      excludedRecords: excludedCount,
      currency: "VND",
    };
  },

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
  async getCombinedRevenue(scope: AnalyticsScope, range: RevenueRange) {
    const ownerIds = await resolveCompanyOwnerIds(scope.companyCode);
    const ownerMatch = ownerIds ? { ownerId: { $in: ownerIds } } : {};
    const stockScope = scope.companyCode ? { companyCode: scope.companyCode } : {};
    const spanMs = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - spanMs);
    const bucketFormat = BUCKET_FORMAT[range.granularity];
    const saleMatch = { ...stockScope, type: "xuất", purpose: "bán" };

    const [tuitionBuckets, previousTuition, excludedTuition, goodsBuckets, previousGoods, goodsQuality, categoryRows, unclassifiedStockOut] = await Promise.all([
      Payment.aggregate([
        { $match: { ...ownerMatch, paidOn: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: { $dateToString: { format: bucketFormat, date: "$paidOn", timezone: "UTC" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { ...ownerMatch, paidOn: { $gte: previousFrom, $lt: range.from } } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ ...ownerMatch, paidOn: { $in: [null, undefined] } }),
      StockLogModel.aggregate([
        { $match: { ...saleMatch, createdAt: { $gte: range.from, $lte: range.to } } },
        { $unwind: "$items" },
        { $match: { "items.unitPrice": { $type: "number" }, "items.lineTotal": { $type: "number" } } },
        { $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$createdAt", timezone: "UTC" } },
          amount: { $sum: "$items.lineTotal" },
          count: { $sum: 1 },
          cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } },
        } },
        { $sort: { _id: 1 } },
      ]),
      StockLogModel.aggregate([
        { $match: { ...saleMatch, createdAt: { $gte: previousFrom, $lt: range.from } } },
        { $unwind: "$items" },
        { $match: { "items.lineTotal": { $type: "number" } } },
        { $group: { _id: null, amount: { $sum: "$items.lineTotal" } } },
      ]),
      StockLogModel.aggregate([
        { $match: { ...saleMatch, createdAt: { $gte: range.from, $lte: range.to } } },
        { $unwind: "$items" },
        { $group: {
          _id: null,
          missingPriceLines: { $sum: { $cond: [{ $isNumber: "$items.lineTotal" }, 0, 1] } },
          missingCostLines: { $sum: { $cond: [{ $isNumber: "$items.unitCost" }, 0, 1] } },
        } },
      ]),
      StockLogModel.aggregate([
        { $match: { ...saleMatch, createdAt: { $gte: range.from, $lte: range.to } } },
        { $unwind: "$items" },
        { $match: { "items.lineTotal": { $type: "number" } } },
        { $lookup: { from: "products", let: { productId: "$items.productId", companyCode: "$companyCode" }, pipeline: [
          { $match: { $expr: { $and: [{ $eq: [{ $toString: "$_id" }, "$$productId"] }, { $eq: ["$companyCode", "$$companyCode"] }] } } },
          { $project: { category: 1 } },
        ], as: "product" } },
        { $group: {
          _id: { $ifNull: [{ $first: "$product.category" }, "Chưa phân loại"] },
          revenue: { $sum: "$items.lineTotal" },
          cost: { $sum: { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] } },
          quantity: { $sum: "$items.quantity" },
          missingCostLines: { $sum: { $cond: [{ $isNumber: "$items.unitCost" }, 0, 1] } },
        } },
        { $sort: { revenue: -1 } },
      ]),
      StockLogModel.countDocuments({
        ...stockScope,
        type: "xuất",
        createdAt: { $gte: range.from, $lte: range.to },
        purpose: { $exists: false },
      }),
    ]);

    const byBucket = new Map<string, RevenueBucket>();
    const ensureBucket = (bucket: string) => {
      if (!byBucket.has(bucket)) {
        byBucket.set(bucket, { bucket, amount: 0, count: 0, tuitionAmount: 0, tuitionCount: 0, goodsAmount: 0, goodsCount: 0 });
      }
      return byBucket.get(bucket)!;
    };
    for (const row of tuitionBuckets) {
      const bucket = ensureBucket(row._id);
      bucket.tuitionAmount = row.amount || 0;
      bucket.tuitionCount = row.count || 0;
    }
    for (const row of goodsBuckets) {
      const bucket = ensureBucket(row._id);
      bucket.goodsAmount = row.amount || 0;
      bucket.goodsCount = row.count || 0;
    }
    const series = [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map((row) => ({
      ...row,
      amount: row.tuitionAmount + row.goodsAmount,
      count: row.tuitionCount + row.goodsCount,
    }));
    const tuitionTotal = series.reduce((sum, row) => sum + row.tuitionAmount, 0);
    const goodsTotal = series.reduce((sum, row) => sum + row.goodsAmount, 0);
    const total = tuitionTotal + goodsTotal;
    const previousTotal = (previousTuition[0]?.amount || 0) + (previousGoods[0]?.amount || 0);
    const missingPriceLines = goodsQuality[0]?.missingPriceLines || 0;
    const missingCostLines = goodsQuality[0]?.missingCostLines || 0;
    const goodsCost = goodsBuckets.reduce((sum, row) => sum + (row.cost || 0), 0);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: range.granularity },
      total,
      tuitionTotal,
      goodsTotal,
      previousTotal,
      growthPct: previousTotal > 0 ? Number((((total - previousTotal) / previousTotal) * 100).toFixed(1)) : null,
      series,
      goodsGrossProfit: missingCostLines === 0 ? goodsTotal - goodsCost : null,
      goodsBreakdown: categoryRows.map((row: any): GoodsCategoryBreakdown => ({
        category: row._id,
        revenue: row.revenue || 0,
        grossProfit: row.missingCostLines > 0 ? null : (row.revenue || 0) - (row.cost || 0),
        quantity: row.quantity || 0,
      })),
      excludedRecords: excludedTuition,
      excludedGoodsLines: missingPriceLines,
      excludedCostLines: missingCostLines,
      excludedUnclassifiedStockOut: unclassifiedStockOut,
      currency: "VND",
    };
  },

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

    const sources: RevenueSourceStatus[] = [
      {
        key: "tuition",
        label: "Học phí / lao động",
        available: true,
      },
      {
        key: "goods",
        label: "Bán hàng từ kho",
        available: true,
        excludedRecords: stockOutTotal - stockOutPriced,
      },
    ];

    return {
      sources,
      grossProfitAvailable: true,
      currency: "VND",
    };
  },
};
