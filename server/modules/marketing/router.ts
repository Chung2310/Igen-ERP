import { Router } from "express";
import { requirePermission } from "../../middleware/auth";
import { marketingController } from "./controllers/marketing.controller";
import { registerMarketingConsumers } from "./consumers/thank-you.consumer";
import { MARKETING_MANAGE_PERMISSION, MARKETING_READ_PERMISSION } from "./permissions";

registerMarketingConsumers();

export const marketingRouter = Router();
const read = requirePermission(MARKETING_READ_PERMISSION) as any;
const manage = requirePermission(MARKETING_MANAGE_PERMISSION) as any;

marketingRouter.get("/settings", read, marketingController.getSettings as any);
marketingRouter.put("/settings", manage, marketingController.updateSettings as any);

marketingRouter.get("/campaigns", read, marketingController.listCampaigns as any);
marketingRouter.post("/campaigns", manage, marketingController.createCampaign as any);
marketingRouter.patch("/campaigns/:id", manage, marketingController.updateCampaign as any);
marketingRouter.delete("/campaigns/:id", manage, marketingController.deleteCampaign as any);

marketingRouter.get("/runs", read, marketingController.listRuns as any);
marketingRouter.post("/runs/:type", manage, marketingController.runScan as any);

marketingRouter.get("/deliveries", read, marketingController.listDeliveries as any);
marketingRouter.post("/deliveries/:id/retry", manage, marketingController.retryDelivery as any);
marketingRouter.post("/test-send", manage, marketingController.sendTest as any);
