import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { leaveController } from "../controller/leave.controller";

export const leaveRouter = Router();
leaveRouter.get("/balance", requireAuth as any, leaveController.balance as any);