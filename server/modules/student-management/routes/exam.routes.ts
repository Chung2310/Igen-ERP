import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  createExamSchema, 
  updateExamSchema, 
  assignStudentSchema, 
  unassignStudentSchema, 
  updateStudentResultSchema, 
  examStudentParamsSchema,
  importResultsSchema
} from "../validations/exam.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS.exam.manage]) as any;

router.use(authMiddleware);

router.post("/", requireManage, validate(createExamSchema), ExamController.create);
router.get("/", ExamController.getList);
router.get("/:id", validate(idParamSchema, "params"), ExamController.getDetail);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updateExamSchema), ExamController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), ExamController.delete);
router.post("/:id/assign", requireManage, validate(idParamSchema, "params"), validate(assignStudentSchema), ExamController.assign);
router.post("/:id/unassign", requireManage, validate(idParamSchema, "params"), validate(unassignStudentSchema), ExamController.unassign);
router.post("/:id/students/:studentId/result", requireManage, validate(examStudentParamsSchema, "params"), validate(updateStudentResultSchema), ExamController.updateStudentResult);
router.post("/:id/import-results", requireManage, validate(idParamSchema, "params"), validate(importResultsSchema), ExamController.importResults);

export default router;
