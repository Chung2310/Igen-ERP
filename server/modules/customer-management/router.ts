import { Router } from "express";
import { requirePermission } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validation";
import { customerController } from "./customer.controller";
import { customerSettingsController } from "./controllers/customer-settings.controller";
import { updateCustomerSettingsSchema } from "./validations/customer-settings.validation";

export const customerRouter = Router();
const read = requirePermission("customer:read") as any;
const manage = requirePermission("customer:manage") as any;

customerRouter.get("/settings", read, customerSettingsController.get as any);
customerRouter.patch("/settings", manage, validateRequest(updateCustomerSettingsSchema), customerSettingsController.update as any);

customerRouter.get("/", read, customerController.list as any);
customerRouter.get("/search", read, customerController.search as any);
customerRouter.post("/", manage, customerController.create as any);
customerRouter.post("/quick", manage, customerController.quickCreate as any);
customerRouter.get("/:id", read, customerController.detail as any);
customerRouter.patch("/:id", manage, customerController.update as any);
customerRouter.post("/:id/activate", manage, customerController.activate as any);
customerRouter.post("/:id/deactivate", manage, customerController.deactivate as any);
customerRouter.get("/:id/billing-profiles", read, customerController.billingProfiles as any);
customerRouter.post("/:id/billing-profiles", manage, customerController.createBillingProfile as any);
