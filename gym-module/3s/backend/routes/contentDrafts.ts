import Joi from 'joi';
import { idParams, objectId } from '../validators/commonValidator.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { enqueueNutritionGeneration, getNutritionGeneration } from '../services/aiNutritionGenerationJobService.js';
import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as c from '../controllers/contentDraftController.js';
import { contentDraftSchema, nutritionAnalysisSchema, roadmapDraftSchema } from '../validators/knowledgeValidator.js';

const router = express.Router();

router.post('/nutrition', authenticate, authorize('PT'), requireFeature('NUTRITION_AI'), validate(contentDraftSchema), c.nutrition);
router.post('/nutrition-analysis', authenticate, authorize('PT', 'ADMIN'), requireFeature('NUTRITION_AI'), validate(nutritionAnalysisSchema), c.nutritionAnalysis);
router.post('/workout', authenticate, authorize('PT'), requireFeature('PT_ASSISTANT'), validate(contentDraftSchema), c.workout);
router.post('/roadmap', authenticate, authorize('PT'), requireFeature('ROADMAP'), validate(roadmapDraftSchema), c.roadmap);

router.post('/nutrition/jobs', authenticate, authorize('PT'), requireFeature('NUTRITION_AI'), validate({ body: Joi.object({
  customerId: objectId.required(), request: Joi.string().trim().min(10).max(10000).required(),
  planId: objectId.allow('', null), durationDays: Joi.number().integer().min(1).max(31),
  idempotencyKey: Joi.string().pattern(/^[A-Za-z0-9._:-]{8,100}$/).required(),
}) }), asyncHandler(async (req, res) => {
  const { idempotencyKey, ...input } = req.body;
  return success(res, { status: 202, message: 'Đã tiếp nhận yêu cầu tạo thực đơn.', data: await enqueueNutritionGeneration(req.user!, input, idempotencyKey) });
}));
router.get('/nutrition/jobs/:id', authenticate, authorize('PT'), requireFeature('NUTRITION_AI'), validate({ params: idParams() }), asyncHandler(async (req, res) =>
  success(res, { message: 'Trạng thái tạo thực đơn.', data: await getNutritionGeneration(req.user!, String(req.params.id)) })
));
export default router;
