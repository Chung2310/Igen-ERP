import { Router } from "express";
import { registerMobilePushSchema, deleteMobilePushSchema } from "../validation/mobile-push.validation";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { MobilePushDevice } from "../model/mobile-push.model";

export const mobilePushRouter = Router();
mobilePushRouter.use(requireAuth as any);
mobilePushRouter.post(
  "/",
  validateRequest({ body: registerMobilePushSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      if (!user.sessionId) return res.status(401).json({ message: "A session is required" });
      // Preserve enrollment time on retries, reset it when ownership changes.
      const existing = await MobilePushDevice.findOne({ token: req.body.token }).lean();
      await MobilePushDevice.findOneAndUpdate(
        { token: req.body.token },
        {
          $set: {
            uid: user.id,
            companyCode: user.companyCode || "SYSTEM",
            sessionId: user.sessionId,
            platform: req.body.platform,
            provider: req.body.provider,
            registeredAt:
              existing?.uid === user.id && existing?.sessionId === user.sessionId ? existing.registeredAt : new Date(),
          },
        },
        { upsert: true },
      );
      res.json({ status: "success" });
    } catch (error) {
      next(error);
    }
  },
);
mobilePushRouter.delete(
  "/",
  validateRequest({ body: deleteMobilePushSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      await MobilePushDevice.deleteOne({ token: req.body.token, uid: req.user!.id, sessionId: req.user!.sessionId });
      res.json({ status: "success" });
    } catch (error) {
      next(error);
    }
  },
);
