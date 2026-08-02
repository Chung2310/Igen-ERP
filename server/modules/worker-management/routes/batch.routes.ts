import { Router } from "express";
import { BatchController } from "../controllers/batch.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createBatchSchema,
  updateBatchSchema,
  addLearnerSchema,
} from "../validations/batch.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
const requireManage = requireAnyPermission([
  ...STUDENT_AREA_PERMISSIONS.batch.manage,
]) as any;

router.use(authMiddleware);

router.post(
  "/",
  requireManage,
  validate(createBatchSchema),
  BatchController.create,
);
router.get("/", BatchController.getList);
router.get(
  "/:id",
  validate(idParamSchema, "params"),
  BatchController.getDetail,
);
router.patch(
  "/:id",
  requireManage,
  validate(idParamSchema, "params"),
  validate(updateBatchSchema),
  BatchController.update,
);
router.delete(
  "/:id",
  requireManage,
  validate(idParamSchema, "params"),
  BatchController.delete,
);
router.post(
  "/:id/learners",
  requireManage,
  validate(idParamSchema, "params"),
  validate(addLearnerSchema),
  BatchController.addLearner,
);
router.delete(
  "/:id/learners/:studentId",
  requireManage,
  BatchController.removeLearner,
);
router.put(
  "/:id/attendance",
  requireManage,
  validate(idParamSchema, "params"),
  BatchController.saveAttendance,
);
router.delete(
  "/:id/attendance",
  requireManage,
  validate(idParamSchema, "params"),
  BatchController.deleteAttendanceByDate,
);

export default router;
