import { Router } from "express";
import { hrLeaveController } from "../controller/hr-leave.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { validateRequest } from "../middleware/validation";
import {
  createLeaveApplicationSchema,
  createLeaveTemplateSchema,
  decideLeaveApplicationSchema,
  leaveIdSchema,
  uploadLeaveFileSchema,
} from "../validation/hr-leave.validation";

export const hrLeaveRouter = Router();
hrLeaveRouter.use(requireAuth as any, requireModule("hr"));

hrLeaveRouter.post("/leave-files/upload", validateRequest(uploadLeaveFileSchema), hrLeaveController.uploadFile as any);
hrLeaveRouter.get("/leave-templates", hrLeaveController.listTemplates as any);
hrLeaveRouter.post("/leave-templates", requirePermission("timekeeping:manage") as any, validateRequest(createLeaveTemplateSchema), hrLeaveController.createTemplate as any);
hrLeaveRouter.delete("/leave-templates/:id", requirePermission("timekeeping:manage") as any, validateRequest(leaveIdSchema), hrLeaveController.deleteTemplate as any);
hrLeaveRouter.get("/leave-applications", hrLeaveController.listApplications as any);
hrLeaveRouter.post("/leave-applications", validateRequest(createLeaveApplicationSchema), hrLeaveController.createApplication as any);
hrLeaveRouter.patch("/leave-applications/:id/decision", validateRequest(decideLeaveApplicationSchema), hrLeaveController.decideApplication as any);
hrLeaveRouter.delete("/leave-applications/:id", validateRequest(leaveIdSchema), hrLeaveController.deleteApplication as any);
