import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { validate } from "../middlewares/validate.middleware";
import { WorkerQrAttendanceController } from "../controllers/worker-qr-attendance.controller";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";
import {
  createQrSessionSchema,
  sessionIdParamSchema,
  workerQrCheckinSchema,
} from "../validations/worker-qr-attendance.validation";

export const workerQrAttendanceRoutes = Router();

// Public routes for workers scanning QR codes (protected by rate limiter).
// Mounted separately at the app level (see server/router/index.ts) so they
// are reachable WITHOUT going through requireAuth — workers scanning the QR
// from their phone are not logged in.
export const workerQrAttendancePublicRoutes = Router();

workerQrAttendancePublicRoutes.post(
  "/checkin",
  publicApiRateLimiter,
  validate(workerQrCheckinSchema),
  WorkerQrAttendanceController.checkin as any
);

workerQrAttendancePublicRoutes.get(
  "/session-info",
  publicApiRateLimiter,
  WorkerQrAttendanceController.getSessionInfo as any
);

// Admin/Manager routes for managing sessions
workerQrAttendanceRoutes.post(
  "/session",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(createQrSessionSchema),
  WorkerQrAttendanceController.createSession as any
);

workerQrAttendanceRoutes.get(
  "/session/:sessionId/token",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  validate(sessionIdParamSchema, "params"),
  WorkerQrAttendanceController.getCurrentToken as any
);

workerQrAttendanceRoutes.get(
  "/session/:sessionId/status",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  validate(sessionIdParamSchema, "params"),
  WorkerQrAttendanceController.getSessionStatus as any
);

workerQrAttendanceRoutes.post(
  "/session/:sessionId/close",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(sessionIdParamSchema, "params"),
  WorkerQrAttendanceController.closeSession as any
);
