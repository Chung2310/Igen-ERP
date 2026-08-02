import { Router } from "express";
import Joi from "joi";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { analyticsController } from "../controller/analytics.controller";

export const analyticsRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const scopeFilters = {
  branchId: Joi.string().optional(),
  courseId: Joi.string().optional(),
};

const revenueSchema = {
  query: Joi.object({
    ...scopeFilters,
    from: Joi.string().regex(DATE_PATTERN).required().messages({
      "string.pattern.base": "from phải đúng định dạng YYYY-MM-DD.",
      "any.required": "Cần chỉ định khoảng thời gian (from).",
    }),
    to: Joi.string().regex(DATE_PATTERN).required().messages({
      "string.pattern.base": "to phải đúng định dạng YYYY-MM-DD.",
      "any.required": "Cần chỉ định khoảng thời gian (to).",
    }),
    granularity: Joi.string().valid("day", "week", "month").optional().messages({
      "any.only": "granularity phải là day, week hoặc month.",
    }),
  }),
};

const dateRangeSchema = {
  query: Joi.object({
    ...scopeFilters,
    from: Joi.string().regex(DATE_PATTERN).required(),
    to: Joi.string().regex(DATE_PATTERN).required(),
    granularity: Joi.string().valid("day", "week", "month").optional(),
  }),
};

const receivablesSchema = {
  query: Joi.object({ ...scopeFilters, asOf: Joi.string().regex(DATE_PATTERN).required() }),
};

const exportSchema = {
  query: Joi.object({
    ...scopeFilters,
    from: Joi.string().regex(DATE_PATTERN).required(),
    to: Joi.string().regex(DATE_PATTERN).required(),
    granularity: Joi.string().valid("day", "week", "month").optional(),
    format: Joi.string().valid("xlsx", "csv").required(),
    report: Joi.string().valid("overview", "revenue", "receivables", "expenses", "pnl").required()
      .when("format", { is: "csv", then: Joi.invalid("overview").messages({ "any.invalid": "CSV chỉ hỗ trợ từng báo cáo; dùng XLSX để xuất toàn bộ." }) }),
  }),
};

const operatingExpenseSchema = {
  body: Joi.object({
    branchId: Joi.string().allow("").optional(),
    category: Joi.string().trim().max(120).required(),
    description: Joi.string().trim().max(500).required(),
    amount: Joi.number().positive().required(),
    incurredOn: Joi.string().regex(DATE_PATTERN).required(),
  }),
};

/**
 * Khu vực Phân tích & Báo cáo — chỉ dành cho admin/superadmin.
 *
 * Gate đặt ở cấp router (không phải từng route) để mọi endpoint thêm về sau đều
 * được bảo vệ mặc định, không phụ thuộc việc người viết có nhớ gắn middleware hay không.
 *
 * Vì chỉ admin/superadmin truy cập được, mọi truy vấn bên trong luôn ở phạm vi
 * toàn công ty (companyCode lấy từ token). `branchId` nếu có chỉ là bộ lọc hiển
 * thị, không phải ranh giới bảo mật — khác với các module dùng chung cho
 * branch_owner. Xem docs/admin-analytics/research.md mục 3.3.
 */
analyticsRouter.use(requireAuth as any, requireRole(["admin", "superadmin"]) as any);

// Metadata: báo cáo nào đang dùng được, nguồn dữ liệu nào còn thiếu điều kiện
analyticsRouter.get("/meta", analyticsController.getMeta as any);

// Doanh thu học phí + bán hàng theo thời gian, kèm so sánh kỳ trước
analyticsRouter.get(
  "/revenue",
  validateRequest(revenueSchema),
  analyticsController.getRevenue as any
);

analyticsRouter.get("/receivables", validateRequest(receivablesSchema), analyticsController.getReceivables as any);
analyticsRouter.get("/expenses", validateRequest(dateRangeSchema), analyticsController.getExpenses as any);
analyticsRouter.get("/operating-expenses", validateRequest(dateRangeSchema), analyticsController.listOperatingExpenses as any);
analyticsRouter.post("/operating-expenses", validateRequest(operatingExpenseSchema), analyticsController.createOperatingExpense as any);
analyticsRouter.delete("/operating-expenses/:id", analyticsController.voidOperatingExpense as any);
analyticsRouter.get("/pnl", validateRequest(dateRangeSchema), analyticsController.getProfitAndLoss as any);
analyticsRouter.get("/export", validateRequest(exportSchema), analyticsController.exportReport as any);
