import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { proposal, generation, generationStatus, exerciseGeneration } from '../controllers/aiWorkoutController.js';
import {
  workoutGenerationRequestSchema,
  workoutProposalRequestSchema,
} from '../validators/aiWorkoutValidator.js';
import { exerciseGenerationRequestSchema } from '../validators/aiExerciseValidator.js';
import { idParams } from '../validators/commonValidator.js';

const router = express.Router();
router.post('/exercise-generations', authenticate, authorize('ADMIN', 'PT'), validate(exerciseGenerationRequestSchema), exerciseGeneration);
router.post('/workout-proposals', authenticate, authorize('ADMIN', 'PT'), validate(workoutProposalRequestSchema), proposal);
router.post('/workout-generations', authenticate, authorize('ADMIN', 'PT'), validate(workoutGenerationRequestSchema), generation);
router.get('/workout-generations/:id', authenticate, authorize('ADMIN', 'PT'), validate({ params: idParams() }), generationStatus);
export default router;
