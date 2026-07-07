import { Router } from "express";
import { AIController } from "../controllers/ai.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { analyzeStudentSchema } from "../validations/ai.validation";

const router = Router();

router.use(authMiddleware);

router.post("/analyze", validate(analyzeStudentSchema), AIController.analyze);

export default router;
