import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/exerciseController.js';
import * as muscleGroupController from '../controllers/muscleGroupController.js';
import { checkExerciseDuplicatesSchema } from '../validators/contentValidator.js';
import { bulkCreateExercisesSchema, contentIdSchema, createExerciseSchema, createMuscleGroupSchema, listExercisesSchema, updateExerciseSchema } from '../validators/contentValidator.js';
const router = express.Router();
const base = [authenticate, authorize('ADMIN', 'PT'), requireFeature('EXERCISE_LIBRARY')] as const;

router.get('/muscle-groups', ...base, muscleGroupController.list);
router.post('/muscle-groups', ...base, validate(createMuscleGroupSchema), muscleGroupController.create);
router.delete('/muscle-groups/:id', ...base, validate(contentIdSchema), muscleGroupController.remove);

router.get('/', ...base, validate(listExercisesSchema), controller.list);
router.post('/bulk', ...base, validate(bulkCreateExercisesSchema), controller.createBulk);
router.post('/duplicate-check', ...base, validate(checkExerciseDuplicatesSchema), controller.checkDuplicates);
router.get('/:id', ...base, validate(contentIdSchema), controller.get);
router.post('/', ...base, validate(createExerciseSchema), controller.create);
router.patch('/:id', ...base, validate(updateExerciseSchema), controller.update);
router.delete('/:id', ...base, validate(contentIdSchema), controller.remove);

export default router;
