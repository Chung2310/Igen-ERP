/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import Joi from "joi";
import { validateRequest } from "../../../../middleware/validation";
import { requireAuth, requireRole } from "../middleware/auth";
import { companyHeyGenController } from "../controller/company-heygen.controller";

export const companyHeyGenRouter = Router();

const apiKeySchema = {
  body: Joi.object({
    apiKey: Joi.string().trim().min(1).max(500).required(),
  }),
};

companyHeyGenRouter.get("/", requireAuth as any, companyHeyGenController.get as any);
companyHeyGenRouter.put(
  "/",
  requireAuth as any,
  requireRole(["admin", "superadmin"]) as any,
  validateRequest(apiKeySchema),
  companyHeyGenController.update as any,
);
companyHeyGenRouter.delete(
  "/",
  requireAuth as any,
  requireRole(["admin", "superadmin"]) as any,
  companyHeyGenController.clear as any,
);