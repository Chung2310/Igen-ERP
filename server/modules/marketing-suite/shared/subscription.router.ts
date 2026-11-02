import { Router } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { aiSubscriptionService } from "./service/ai-subscription.service";
import { aiUserSubscriptionService } from "./service/ai-user-subscription.service";
import { AiSubscriptionPlanModel, AiUsageModel } from "./model/ai-subscription.model";
import { getSubscriptionHistory } from './service/ai-subscription-history.service';

export const subscriptionRouter = Router();
subscriptionRouter.get('/history', async (req: AuthenticatedRequest, res, next) => {
  try {
    const companyCode = req.user?.companyCode?.trim().toUpperCase();
    if (!companyCode) return res.status(403).json({ status: 'error', message: 'Không xác định được doanh nghiệp.' });
    const page = req.query.page ?? '1';
    if (typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page)) return res.status(400).json({ status: 'error', message: 'Trang lịch sử không hợp lệ.' });
    const history = await getSubscriptionHistory(companyCode, Number(page));
    return res.json({ status: 'success', data: history });
  } catch (error) { next(error); }
});
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
  const personal = req.user?.id ? await aiUserSubscriptionService.summary(req.user.id) : null;
  const personalActive = personal?.status === "active" && personal.companyCode === companyCode;
  const [companySubscription, usage] = await Promise.all([
    aiSubscriptionService.summary(companyCode),
    AiUsageModel.find(personalActive ? { companyCode, userId: req.user!.id, billingScope: "user" } : { companyCode, billingScope: { $ne: "user" } })
      .select("kind model units status createdAt completedAt").sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  const subscription = personalActive ? { ...personal, scope: "user" } : companySubscription ? { ...companySubscription, scope: "company" } : null;
  res.json({ status: "success", data: { subscription, usage } });
  } catch (error) { next(error); }
});
