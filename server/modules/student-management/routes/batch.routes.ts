import { Router } from "express";
import { BatchController } from "../controllers/batch.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createBatchSchema, updateBatchSchema, addLearnerSchema } from "../validations/batch.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.post("/", validate(createBatchSchema), BatchController.create);
router.get("/", BatchController.getList);
router.get("/:id", validate(idParamSchema, "params"), BatchController.getDetail);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateBatchSchema), BatchController.update);
router.delete("/:id", validate(idParamSchema, "params"), BatchController.delete);
router.post("/:id/learners", validate(idParamSchema, "params"), validate(addLearnerSchema), BatchController.addLearner);
router.delete("/:id/learners/:studentId", BatchController.removeLearner);

export default router;
