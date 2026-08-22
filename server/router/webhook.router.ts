import { Router } from 'express';
import { WebhookController } from '../modules/student-management/controllers/webhook.controller';
import { retailSePayController } from '../modules/retail/controllers/retail-sepay.controller';

export const webhookRouter = Router();

// Keep the legacy SePay URL working while using the same company-aware
// payment processor as the student-management webhook route.
webhookRouter.post('/payment', WebhookController.handlePaymentWebhook);
webhookRouter.post('/sepay/retail-payment', retailSePayController.webhook);
