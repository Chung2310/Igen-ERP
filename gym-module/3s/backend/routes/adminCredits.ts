import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/creditAdminController.js';
import { adjustmentAdminSchema, adminListSchema, createPackageAdminSchema, packageParamsAdminSchema, pricingAdminSchema, updatePackageAdminSchema } from '../validators/creditValidator.js';

const router = express.Router(); router.use(authenticate, authorize('ADMIN'));
router.get('/credit-pricing', controller.pricing); router.patch('/credit-pricing', authorize('SUPER_ADMIN'), validate(pricingAdminSchema), controller.updatePricing);
router.get('/credit-packages', controller.packages); router.post('/credit-packages', authorize('SUPER_ADMIN'), validate(createPackageAdminSchema), controller.createPackage);
router.patch('/credit-packages/:id', authorize('SUPER_ADMIN'), validate(updatePackageAdminSchema), controller.updatePackage); router.delete('/credit-packages/:id', authorize('SUPER_ADMIN'), validate(packageParamsAdminSchema), controller.deletePackage);
router.post('/credit-adjustments', validate(adjustmentAdminSchema), controller.adjustment);
router.get('/payment-orders', validate(adminListSchema), controller.paymentOrders); router.get('/ai-usage', validate(adminListSchema), controller.aiUsage);
router.get('/credit-ledger', validate(adminListSchema), controller.ledger); router.get('/credit-shortfalls', validate(adminListSchema), controller.shortfalls);
export default router;
