import { Router } from "express";
import Joi from "joi";
import { validateRequest } from "../middleware/validation";
import { superAdminAssistantFeedbackService } from "../super-admin/assistant-feedback.service";

const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? helpers.error("any.invalid")
    : value;
});
const reportQuery = Joi.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  companyCode: Joi.string().trim().max(80).optional(),
  branchId: Joi.string().trim().max(80).optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  search: Joi.string().trim().max(160).allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).custom((value, helpers) => value.from && value.to && value.from > value.to
  ? helpers.error("any.invalid")
  : value);

export function createSuperAdminAssistantFeedbackRouter() {
  const router = Router();
  router.get("/reports", validateRequest({ query: reportQuery }), async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await superAdminAssistantFeedbackService.list(req.query as any);
      return res.json(result);
    } catch (error) {
      console.error("[super admin assistant feedback]", error);
      return res.status(500).json({ message: "Không thể tải báo cáo đánh giá trợ lý ERP." });
    }
  });
  router.get("/branches", validateRequest({ query: Joi.object({ companyCode: Joi.string().trim().max(80).required() }) }), async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const branches = await superAdminAssistantFeedbackService.branches(String(req.query.companyCode));
      return res.json({ branches });
    } catch (error) {
      console.error("[super admin assistant feedback branches]", error);
      return res.status(500).json({ message: "Không thể tải danh sách chi nhánh." });
    }
  });
  return router;
}
