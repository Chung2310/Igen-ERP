import { Router } from "express";
import { requireAnyPermission } from "../../../middleware/auth";
import { LearningRoadmapController } from "../controllers/learning-roadmap.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";
import { batchProgressionQuerySchema, createLearningRoadmapSchema, placeWaitlistSchema, progressionDecisionSchema, updateLearningRoadmapSchema, waitlistQuerySchema } from "../validations/learning-roadmap.validation";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS["learning-roadmap"].manage]) as any;
router.use(authMiddleware);
router.get("/", LearningRoadmapController.list);
router.post("/", requireManage, validate(createLearningRoadmapSchema), LearningRoadmapController.create);
router.patch("/:id", requireManage, validate(updateLearningRoadmapSchema), LearningRoadmapController.update);
router.get("/batches/:batchId/progression", validate(batchProgressionQuerySchema, "query"), LearningRoadmapController.batchProgression);
router.patch("/batches/:batchId/students/:studentId/progression", requireManage, validate(progressionDecisionSchema), LearningRoadmapController.saveDecision);
router.get("/waitlist", validate(waitlistQuerySchema, "query"), LearningRoadmapController.waitlist);
router.post("/waitlist/place", requireManage, validate(placeWaitlistSchema), LearningRoadmapController.place);
export default router;
