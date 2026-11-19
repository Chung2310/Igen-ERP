import express from 'express';
const router = express.Router();
import * as authController from '../controllers/authController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerCenterSchema, registerPtSchema, refreshSchema, logoutSchema, ownerDeletionSchema } from '../validators/authValidator.js';
import { updateSelfProfileSchema } from '../validators/userValidator.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';

router.post('/register-center', authenticate, authorize('SUPER_ADMIN'), createRateLimiter({ limit: 5, windowMs: 15 * 60_000 }), validate(registerCenterSchema), authController.registerCenter);
router.post('/register-pt', createRateLimiter({ limit: 5, windowMs: 15 * 60_000 }), validate(registerPtSchema), authController.registerPt);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateSelfProfileSchema), authController.updateMe);
router.delete('/me', authenticate, authController.deleteMe);
router.get('/me/deletion-options', authenticate, authorize('ADMIN'), authController.deletionOptions);
router.post('/me/delete-owner', authenticate, authorize('ADMIN'), createRateLimiter({ limit: 5, windowMs: 15 * 60_000 }), validate(ownerDeletionSchema), authController.deleteOwner);
router.post('/push-token', authenticate, authController.updatePushToken);

export default router;

