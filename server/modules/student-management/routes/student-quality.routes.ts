import { Router } from "express";
import { requireAnyPermission } from "../../../middleware/auth";
import { StudentQualityController } from "../controllers/student-quality.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";
import { requireTeacherOperation } from "../middlewares/teacher-operation.middleware";
import {
  assignmentScoreParamsSchema,
  createMiniTestSchema,
  gradeAssignmentSchema,
  qualityThresholdSchema,
  miniTestParamsSchema,
  studentQualityListSchema,
  studentQualityParamsSchema,
  updateMiniTestSchema,
  updateStudentQualitySchema,
} from "../validations/student-quality.validation";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS["student-quality"].manage]) as any;

router.use(authMiddleware);
router.get("/settings/thresholds", StudentQualityController.getThresholds);
router.patch("/settings/thresholds", requireManage, validate(qualityThresholdSchema), StudentQualityController.updateThresholds);
router.get("/", validate(studentQualityListSchema, "query"), StudentQualityController.list);
router.get("/batches/:batchId/students/:studentId", validate(studentQualityParamsSchema, "params"), StudentQualityController.detail);
router.patch("/batches/:batchId/students/:studentId", requireTeacherOperation, validate(studentQualityParamsSchema, "params"), validate(updateStudentQualitySchema), StudentQualityController.updateAssessment);
router.post("/batches/:batchId/students/:studentId/mini-tests", requireTeacherOperation, validate(studentQualityParamsSchema, "params"), validate(createMiniTestSchema), StudentQualityController.createMiniTest);
router.patch("/batches/:batchId/students/:studentId/mini-tests/:miniTestId", requireTeacherOperation, validate(miniTestParamsSchema, "params"), validate(updateMiniTestSchema), StudentQualityController.updateMiniTest);
router.delete("/batches/:batchId/students/:studentId/mini-tests/:miniTestId", requireTeacherOperation, validate(miniTestParamsSchema, "params"), StudentQualityController.deleteMiniTest);
router.patch("/batches/:batchId/students/:studentId/assignments/:assignmentId", requireTeacherOperation, validate(assignmentScoreParamsSchema, "params"), validate(gradeAssignmentSchema), StudentQualityController.gradeAssignment);

export default router;
