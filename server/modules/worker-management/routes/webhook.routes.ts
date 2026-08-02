import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";
import { validate } from "../middlewares/validate.middleware";
import { webhookPaymentSchema } from "../validations/webhook.validation";

const router = Router();

router.post(
  "/payment",
  validate(webhookPaymentSchema),
  WebhookController.handlePaymentWebhook,
);

export default router;
