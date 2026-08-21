import { Router } from "express";
import { knowledgeController } from "../controller/knowledge.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
export const knowledgeRouter = Router();
knowledgeRouter.get("/", requireAuth as any, requirePermission("resource:read") as any, knowledgeController.list as any);
knowledgeRouter.post("/sync", requireAuth as any, requirePermission("resource:manage") as any, knowledgeController.sync as any);
knowledgeRouter.delete("/:id", requireAuth as any, requirePermission("resource:manage") as any, knowledgeController.remove as any);
