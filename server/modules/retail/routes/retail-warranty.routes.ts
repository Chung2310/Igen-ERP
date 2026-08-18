import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailWarrantyController } from "../controllers/retail-warranty.controller";

export const retailWarrantyRoutes = Router();
retailWarrantyRoutes.get("/lookup/:code", requirePermission("retail:read") as any, retailWarrantyController.lookup as any);
retailWarrantyRoutes.get("/expiring", requirePermission("retail:manage") as any, retailWarrantyController.expiring as any);
retailWarrantyRoutes.get("/gap-risk", requirePermission("retail:manage") as any, retailWarrantyController.gapRisk as any);
retailWarrantyRoutes.patch("/serial/:id", requirePermission("retail:manage") as any, retailWarrantyController.update as any);
