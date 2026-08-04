import { Router } from 'express';
import { WebhookController } from '../modules/student-management/controllers/webhook.controller';

export const webhookRouter = Router();

// Keep the legacy SePay URL working while using the same company-aware
// payment processor as the student-management webhook route.
webhookRouter.post('/payment', WebhookController.handlePaymentWebhook);
