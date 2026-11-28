import { Router } from "express";
import Joi from "joi";
import { requirePermission } from "../../../middleware/auth";
import { WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION } from "../permissions";
import { workerOverviewReport, workerReport } from "../services/worker-report.service";
export const workerReportRoutes = Router();
const calendarDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : helpers.error("any.invalid");
});
const schema = Joi.object({
  branchId: Joi.string(), companyCode: Joi.string(),
  mode: Joi.string().valid("all", "late", "absent", "absence-threshold", "shortage", "filled", "gps-enabled", "labor-types").default("all"),
  projectId: Joi.string().hex().length(24), date: calendarDate, from: calendarDate, to: calendarDate, threshold: Joi.number().integer().min(0).max(366),
}).with("from", "to").with("to", "from");
workerReportRoutes.get("/", requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any, async (req: any, res) => {
  const parsed = schema.validate(req.query);
  if (parsed.error) { res.status(400).json({ message: parsed.error.message }); return; }
  if (parsed.value.mode === "absence-threshold" && !parsed.value.from) { res.status(400).json({ message: "Cần ngày bắt đầu và kết thúc để đếm buổi chưa chấm công." }); return; }
  try { res.json({ success: true, data: await workerReport(req.user.companyCode, req.user.branchId, parsed.value) }); }
  catch (error) { res.status(400).json({ message: (error as Error).message }); }
});
const overviewSchema = Joi.object({ branchId: Joi.string(), companyCode: Joi.string(), page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(1000), from: calendarDate.required(), to: calendarDate.required() }).custom((value, helpers) => {
  if (value.from > value.to) return helpers.error("any.invalid");
  return value;
}).messages({ "any.invalid": "Khoảng ngày báo cáo không hợp lệ." });
workerReportRoutes.get("/overview", requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any, async (req: any, res) => {
  const parsed = overviewSchema.validate(req.query);
  if (parsed.error) { res.status(400).json({ message: parsed.error.message }); return; }
  try { res.json({ success: true, data: await workerOverviewReport(req.user.companyCode, req.user.branchId, parsed.value) }); }
  catch (error) { res.status(400).json({ message: (error as Error).message }); }
});
