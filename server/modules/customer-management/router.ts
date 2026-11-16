import { Router } from "express";
import { requirePermission } from "../../middleware/auth";
import { requireModule } from "../../middleware/require-module";
import { validateRequest } from "../../middleware/validation";
import { CustomerService } from "./customer.service";
import { CRMTicketModel } from "../marketing-suite/message/model/crm-ticket.model";
import { customerController, scopeFromRequest } from "./customer.controller";
import { customerSettingsController } from "./controllers/customer-settings.controller";
import { updateCustomerSettingsSchema } from "./validations/customer-settings.validation";
import { customerModuleLinksRouter } from "./customer-module-links.router";
import { customerRepairsRouter } from "./customer-repairs.router";
import { customerTransactionsRouter } from './customer-transactions.router';

export const customerRouter = Router();
const read = requirePermission("customer:read") as any;
const manage = requirePermission("customer:manage") as any;
const posCustomerSearch = requirePermission(["customer:read", "pos:manage", "repair:manage"]) as any;
const readRetailHistory = requirePermission(["retail:read", "retail:manage"]) as any;
const posCustomerCreate = requirePermission(["customer:manage", "pos:manage"]) as any;

customerRouter.get("/settings", read, customerSettingsController.get as any);
customerRouter.patch("/settings", manage, validateRequest(updateCustomerSettingsSchema), customerSettingsController.update as any);

customerRouter.get("/", read, customerController.list as any);
customerRouter.get("/search", requirePermission(["customer:read", "pos:manage", "repair:manage", "people:manage", "healthcare:manage"]), customerController.search as any);
customerRouter.post("/", posCustomerCreate, customerController.create as any);
customerRouter.post("/quick", manage, customerController.quickCreate as any);
customerRouter.get("/:id/purchase-history", read, requireModule("retail"), readRetailHistory, customerController.purchaseHistory as any);
customerRouter.get("/:id/lead-needs", read, requireModule("omni-inbox"), requirePermission("omni-inbox:read"), async (req, res, next) => {
  try {
    const scope = scopeFromRequest(req);
    await CustomerService.detail(scope, req.params.id);
    const leads = await CRMTicketModel.find({ ...scope, customerId: req.params.id })
      .select("_id needs intakeFields productOfChoice sourcePlatform lastInteractionAt").sort({ lastInteractionAt: -1, _id: -1 }).limit(50).lean();
    res.json({ success: true, data: leads.map(lead => ({
      id: String(lead._id), needs: lead.needs, intakeFields: lead.intakeFields,
      productOfChoice: lead.productOfChoice, sourcePlatform: lead.sourcePlatform,
    })) });
  } catch (error) { next(error); }
});
customerRouter.use(customerModuleLinksRouter);
customerRouter.use(customerRepairsRouter);
customerRouter.use(customerTransactionsRouter);
customerRouter.get("/:id", read, customerController.detail as any);
customerRouter.patch("/:id", manage, customerController.update as any);
customerRouter.post("/:id/activate", manage, customerController.activate as any);
customerRouter.post("/:id/deactivate", manage, customerController.deactivate as any);
customerRouter.get("/:id/billing-profiles", posCustomerSearch, customerController.billingProfiles as any);
customerRouter.post("/:id/billing-profiles", posCustomerCreate, customerController.createBillingProfile as any);
