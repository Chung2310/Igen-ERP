import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailInvoiceController } from "../controllers/retail-invoice.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";
export const retailInvoiceRoutes = Router(); const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
retailInvoiceRoutes.get("/", operate, retailInvoiceController.list as any);
retailInvoiceRoutes.get("/:id/pdf", operate, retailInvoiceController.pdf as any);
retailInvoiceRoutes.get("/:id", operate, retailInvoiceController.detail as any);
