import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { idParams } from '../validators/commonValidator.js';
import { getSessionDraft, saveSessionDraft, deleteSessionDraft } from '../services/workoutSessionDraftService.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'PT'), requireFeature('PROGRESS'));
const params = idParams('customerId');
router.get('/:customerId', validate({ params }), asyncHandler(async (req, res) => success(res, {
  message: 'Workout session draft.', data: await getSessionDraft(req.user!, String(req.params.customerId)),
})));
router.patch('/:customerId', validate({ params, body: Joi.object({
  revision: Joi.number().integer().min(0).required(),
  idempotencyKey: Joi.string().trim().max(200).required(),
  form: Joi.object().unknown(true).required(),
  plan: Joi.object().unknown(true).required(),
  pendingPayload: Joi.object().unknown(true).allow(null),
}).custom((value, helpers) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= 2 * 1024 * 1024 ? value : helpers.error('any.invalid')) }), asyncHandler(async (req, res) => success(res, {
  message: 'Đã lưu bản nháp buổi tập.', data: await saveSessionDraft(req.user!, String(req.params.customerId), req.body),
})));
router.delete('/:customerId', validate({ params, query: Joi.object({ revision: Joi.number().integer().min(1).required() }) }), asyncHandler(async (req, res) => {
  await deleteSessionDraft(req.user!, String(req.params.customerId), Number(req.query.revision));
  return success(res, { message: 'Đã xóa bản nháp.', data: null });
}));
export default router;
