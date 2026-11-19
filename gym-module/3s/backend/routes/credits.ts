import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/creditController.js';
import { ledgerQuerySchema, orderParamsSchema, topupSchema } from '../validators/creditValidator.js';

const router = express.Router();
const callbackLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

router.post('/payments/sepay/webhook', callbackLimiter, controller.sepayWebhook);
router.post('/payments/payos/webhook', callbackLimiter, controller.payosWebhook);
router.get('/payments/vnpay/ipn', callbackLimiter, controller.vnpayIpn);
router.get('/payments/vnpay/return', callbackLimiter, controller.vnpayReturn);
router.post('/payments/momo/ipn', callbackLimiter, controller.momoIpn);
router.use(authenticate);
router.get('/me', controller.me);
router.get('/me/ledger', validate(ledgerQuerySchema), controller.ledger);
router.get('/packages', controller.packages);
router.post('/topups', createRateLimiter({ limit: 20, windowMs: 60_000 }), validate(topupSchema), controller.createTopup);
router.get('/topups/:id', createRateLimiter({ limit: 120, windowMs: 60_000 }), validate(orderParamsSchema), controller.topup);

export default router;
