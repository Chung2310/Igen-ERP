import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { reminderController } from "../controllers/reminder.controller";
import { RECEIVABLE_ADJUST_PERMISSION, RECEIVABLE_READ_PERMISSION } from "../permissions";

export const FINANCE_REMINDER_ROUTE_PERMISSIONS = {
  "GET /runs": RECEIVABLE_READ_PERMISSION,
  "GET /runs/:id": RECEIVABLE_READ_PERMISSION,
  "POST /runs": RECEIVABLE_ADJUST_PERMISSION,
  "POST /deliveries/:id/retry": RECEIVABLE_ADJUST_PERMISSION,
} as const;

export const financeReminderRoutes = Router();
const read = requirePermission(RECEIVABLE_READ_PERMISSION) as any;
const adjust = requirePermission(RECEIVABLE_ADJUST_PERMISSION) as any;
financeReminderRoutes.get("/runs", read, reminderController.list as any);
financeReminderRoutes.get("/runs/:id", read, reminderController.detail as any);
financeReminderRoutes.post("/runs", adjust, reminderController.run as any);
financeReminderRoutes.post("/deliveries/:id/retry", adjust, reminderController.retry as any);
