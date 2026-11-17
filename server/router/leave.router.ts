import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { leaveController } from "../controller/leave.controller";
import { requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import Joi from "joi";

export const leaveRouter = Router();
leaveRouter.get("/balance", requireAuth as any, leaveController.balance as any);
leaveRouter.get("/balances", requireAuth as any, requirePermission(["hr:read", "access:read", "timekeeping:read"]) as any,
  validateRequest({ query: Joi.object({
    year: Joi.number().integer().min(2000).max(2200).optional(),
    companyCode: Joi.string().optional(), branchId: Joi.string().optional(),
    page: Joi.number().integer().min(1).optional(), limit: Joi.number().integer().min(1).max(1000).optional(),
  }).unknown(false) }),
  leaveController.balances as any);
