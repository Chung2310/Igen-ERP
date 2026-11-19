import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { validate } from '../middlewares/validate.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { createGymInvitation, listGymInvitations, respondToGymInvitation } from '../services/gymInvitationService.js';

const router = express.Router();
router.use(authenticate);
router.get('/', authorize('ADMIN', 'PT'), asyncHandler(async (req, res) => success(res, { message: 'Danh sách lời mời.', data: await listGymInvitations(req.user!) })));
router.post('/', authorize('ADMIN'), createRateLimiter({ limit: 20, windowMs: 15 * 60_000 }), validate({ body: Joi.object({ username: Joi.string().trim().min(3).max(64).required() }) }), asyncHandler(async (req, res) => success(res, { message: 'Đã gửi lời mời.', status: 201, data: await createGymInvitation(req.user!, req.body.username) })));
router.post('/:id/respond', authorize('ADMIN', 'PT'), validate({
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({ action: Joi.string().valid('ACCEPT', 'DECLINE', 'CANCEL').required(), transferConsent: Joi.boolean().strict().default(false) }),
}), asyncHandler(async (req, res) => success(res, { message: 'Đã xử lý lời mời.', data: await respondToGymInvitation(req.user!, String(req.params.id), req.body.action, req.body.transferConsent) })));
export default router;
