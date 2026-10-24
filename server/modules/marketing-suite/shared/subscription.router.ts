import { Router } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { aiSubscriptionService } from "./service/ai-subscription.service";
import { AiSubscriptionPlanModel, AiUsageModel } from "./model/ai-subscription.model";

export const subscriptionRouter = Router();
subscriptionRouter.get("/plans", async (_req, res, next) => {
  try {
    const plans = await AiSubscriptionPlanModel.find({ active: true, priceVnd: { $gte: 0 } })
      .select("code name description durationDays aiLimit priceVnd active updatedAt")
      .sort({ aiLimit: 1, durationDays: 1, code: 1 }).lean();
    res.json({ status: "success", data: { plans } });
  } catch (error) { next(error); }
});
subscriptionRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
  const companyCode = req.user!.companyCode!.trim().toUpperCase();
  await aiSubscriptionService.recoverExpired(companyCode);
  const [subscription, usage] = await Promise.all([
    aiSubscriptionService.summary(companyCode),
    AiUsageModel.find({ companyCode }).select("kind model units status createdAt completedAt").sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  res.json({ status: "success", data: { subscription, usage } });
  } catch (error) { next(error); }
});
