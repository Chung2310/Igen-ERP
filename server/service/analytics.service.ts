import { StockLogModel } from "../model/stock-log.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { Payment } from "../modules/student-management/models/payment.model";
import { Partner } from "../modules/student-management/models/partner.model";
import { Student } from "../modules/student-management/models/student.model";
import { User } from "../modules/student-management/models/user.model";
import { buildCompanyUserFilter } from "../modules/student-management/utils/auth.util";
import { OperatingExpenseModel } from "../model/operating-expense.model";
import { BranchModel } from "../model/branch.model";
import { Course } from "../modules/student-management/models/course.model";
import { Batch } from "../modules/student-management/models/batch.model";

export interface AnalyticsScope {
  companyCode?: string;
  branchId?: string;
  courseId?: string;
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

async function resolveCourseStudentIds(scope: AnalyticsScope): Promise<string[] | null> {
  if (!scope.courseId) return null;
  const query: Record<string, unknown> = { courseId: scope.courseId };
  if (scope.branchId) query.branchId = scope.branchId;
  return (await Student.find(query).select("_id").lean()).map((student: any) => String(student._id));
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
    const studentIds = await resolveCourseStudentIds(scope);
    const paymentScope = { ...ownerMatch, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...(studentIds ? { studentId: { $in: studentIds } } : {}) };
    const stockScope = { ...(scope.companyCode ? { companyCode: scope.companyCode } : {}), ...(scope.branchId ? { branchId: scope.branchId } : {}) };
    const spanMs = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - spanMs);
    const bucketFormat = BUCKET_FORMAT[range.granularity];
    const saleMatch = { ...stockScope, type: "xuất", purpose: "bán" };

    const [tuitionBuckets, previousTuition, excludedTuition, goodsBuckets, previousGoods, goodsQuality, categoryRows, unclassifiedStockOut] = await Promise.all([
      Payment.aggregate([
        { $match: { ...paymentScope, paidOn: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: { $dateToString: { format: bucketFormat, date: "$paidOn", timezone: "UTC" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentScope, paidOn: { $gte: previousFrom, $lt: range.from } } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ ...paymentScope, paidOn: { $in: [null, undefined] } }),
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
        { $group: {
          _id: { $ifNull: ["$items.category", "Chưa phân loại"] },
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

  async getReceivables(scope: AnalyticsScope, asOf: Date) {
    const ownerIds = await resolveCompanyOwnerIds(scope.companyCode);
    const ownerMatch = { ...(ownerIds ? { ownerId: { $in: ownerIds } } : {}), ...(scope.branchId ? { branchId: scope.branchId } : {}), ...(scope.courseId ? { courseId: scope.courseId } : {}) };
    const rows = await Student.aggregate([
      { $match: ownerMatch },
      { $unwind: "$installmentStatus" },
      { $match: { "installmentStatus.status": { $ne: "Đã thu" }, "installmentStatus.amountDue": { $gt: 0 } } },
      { $project: { _id: 0, amountDue: "$installmentStatus.amountDue", dueAt: "$installmentStatus.dueAt" } },
    ]);
    const order = ["notScheduled", "notDue", "0-30", "31-60", "60+"];
    const byKey = new Map(order.map((bucket) => [bucket, { amount: 0, count: 0 }]));
    for (const row of rows as Array<{ amountDue?: number; dueAt?: Date | string }>) {
      const dueOn = row.dueAt ? new Date(row.dueAt) : null;
      let bucket = "notScheduled";
      if (dueOn && Number.isFinite(dueOn.getTime())) {
        const ageDays = Math.floor((asOf.getTime() - dueOn.getTime()) / 86_400_000);
        bucket = ageDays < 0 ? "notDue" : ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : "60+";
      }
      const current = byKey.get(bucket)!;
      current.amount += Number(row.amountDue) || 0;
      current.count += 1;
    }
    const aging = order.map((bucket) => ({ bucket, amount: byKey.get(bucket)?.amount || 0, count: byKey.get(bucket)?.count || 0 }));
    return {
      asOf: asOf.toISOString(),
      total: aging.reduce((sum, row) => sum + row.amount, 0),
      count: aging.reduce((sum, row) => sum + row.count, 0),
      aging,
      agingBasis: "dueAt",
      currency: "VND",
    };
  },

  async getExpenses(scope: AnalyticsScope, range: RevenueRange) {
    const ownerIds = await resolveCompanyOwnerIds(scope.companyCode);
    const partnerOwnerMatch = ownerIds ? { ownerId: { $in: ownerIds } } : {};
    const payrollScope = { ...(scope.companyCode ? { companyCode: scope.companyCode } : {}), ...(scope.branchId ? { branchId: scope.branchId } : {}) };
    const [payrollRows, commissionRows, operatingRows] = await Promise.all([
      PayrollPaymentModel.aggregate([
        { $match: { ...payrollScope, status: "confirmed", paymentDate: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Partner.aggregate([
        { $match: partnerOwnerMatch },
        { $unwind: "$payoutHistory" },
        { $addFields: { payoutOn: { $dateFromString: { dateString: "$payoutHistory.date", format: "%d/%m/%Y", onError: null, onNull: null } } } },
        { $facet: {
          valid: [
            { $match: { payoutOn: { $gte: range.from, $lte: range.to } } },
            { $group: { _id: null, amount: { $sum: "$payoutHistory.amount" }, count: { $sum: 1 } } },
          ],
          invalid: [
            { $match: { payoutOn: null } },
            { $count: "count" },
          ],
        } },
      ]),
      OperatingExpenseModel.aggregate([
        { $match: { ...payrollScope, status: "confirmed", incurredOn: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: "$category", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]),
    ]);
    const payroll = payrollRows[0] || {};
    const commissionFacet = commissionRows[0] || {};
    const commission = commissionFacet.valid?.[0] || {};
    const payrollAmount = payroll.amount || 0;
    const commissionAmount = commission.amount || 0;
    const operatingAmount = operatingRows.reduce((sum: number, row: any) => sum + (row.amount || 0), 0);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      total: payrollAmount + commissionAmount + operatingAmount,
      payroll: { amount: payrollAmount, count: payroll.count || 0 },
      commission: { amount: commissionAmount, count: commission.count || 0 },
      operating: { amount: operatingAmount, count: operatingRows.reduce((sum: number, row: any) => sum + (row.count || 0), 0) },
      operatingByCategory: operatingRows.map((row: any) => ({ category: row._id, amount: row.amount || 0, count: row.count || 0 })),
      excludedCommissionRecords: commissionFacet.invalid?.[0]?.count || 0,
      currency: "VND",
    };
  },

  async getProfitAndLoss(scope: AnalyticsScope, range: RevenueRange) {
    const [revenue, expenses] = await Promise.all([
      this.getCombinedRevenue(scope, range),
      this.getExpenses(scope, range),
    ]);
    const contributionBeforeExpenses = revenue.goodsGrossProfit === null
      ? null
      : revenue.tuitionTotal + revenue.goodsGrossProfit;
    return {
      range: revenue.range,
      revenue: revenue.total,
      tuitionRevenue: revenue.tuitionTotal,
      goodsRevenue: revenue.goodsTotal,
      goodsGrossProfit: revenue.goodsGrossProfit,
      payrollExpense: expenses.payroll.amount,
      commissionExpense: expenses.commission.amount,
      generalOperatingExpense: expenses.operating?.amount || 0,
      totalOperatingExpenses: expenses.total,
      operatingResult: contributionBeforeExpenses === null ? null : contributionBeforeExpenses - expenses.total,
      excludedCostLines: revenue.excludedCostLines,
      excludedCommissionRecords: expenses.excludedCommissionRecords,
      currency: "VND",
    };
  },

  async getMeta(scope: AnalyticsScope) {
    const stockQuery = scope.companyCode ? { companyCode: scope.companyCode } : {};
    const ownerIds = await resolveCompanyOwnerIds(scope.companyCode);

    const [stockOutTotal, stockOutPriced, branches, courses, projects] = await Promise.all([
      StockLogModel.countDocuments({ ...stockQuery, type: "xuất" }),
      StockLogModel.countDocuments({
        ...stockQuery,
        type: "xuất",
        "items.unitPrice": { $exists: true },
      }),
      BranchModel.find({ ...(scope.companyCode ? { companyCode: scope.companyCode } : {}), isActive: true }).select("_id code name").sort({ name: 1 }).lean(),
      Course.find(ownerIds ? { ownerId: { $in: ownerIds } } : {}).select("_id code title branchId").sort({ title: 1 }).lean(),
      Batch.find(ownerIds ? { ownerId: { $in: ownerIds } } : {}).select("_id code name branchId").sort({ createdAt: -1 }).lean(),
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
      filters: {
        branches: branches.map((branch: any) => ({ id: String(branch._id), code: branch.code, name: branch.name })),
        courses: courses.map((course: any) => ({ id: String(course._id), code: course.code, name: course.title, branchId: course.branchId })),
        // Dự án (batch) để gắn khoản chi vận hành; tên rỗng thì hiển thị theo mã
        projects: projects.map((project: any) => ({ id: String(project._id), code: project.code, name: project.name || project.code, branchId: project.branchId })),
      },
    };
  },
};
