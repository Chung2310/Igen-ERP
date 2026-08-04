import { Router } from 'express';
import { handleSePayWebhook } from '../controller/webhook.controller';

export const webhookRouter = Router();

webhookRouter.post('/payment', handleSePayWebhook);
