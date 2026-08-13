import { Router } from "express";
import { AssignmentController } from "../controllers/assignment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createAssignmentSchema,
  submitProofSchema,
  uploadProofFileSchema,
  gradeSubmissionSchema,
  staffSubmitProofSchema
} from "../validations/assignment.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireModule } from "../../../middleware/require-module";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";
import { requireTeacherOperation } from "../middlewares/teacher-operation.middleware";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as any;
const requireRead = requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.read]) as any;

// Public routes for student submission (via encrypted JWT token in query parameter)
router.get("/public/detail", AssignmentController.getPublicDetail);
router.post("/public/upload", validate(uploadProofFileSchema), AssignmentController.uploadProofFile);
router.post("/public/submit", validate(submitProofSchema), AssignmentController.submitProof);
router.post("/public/cancel", AssignmentController.cancelSubmission);

// Private routes for Teachers & Admins
router.use(authMiddleware);
const studentModuleGuard = requireModule("student") as any;
const workerModuleGuard = requireModule("worker") as any;
router.use((req, res, next) => (req.originalUrl.includes("/worker-management/") ? workerModuleGuard : studentModuleGuard)(req, res, next));
router.use(requireRead);
router.post("/", requireTeacherOperation, validate(createAssignmentSchema), AssignmentController.create);
router.get("/", AssignmentController.getList);
router.get("/:id/submissions", validate(idParamSchema, "params"), AssignmentController.getSubmissions);
router.post("/:id/students/:studentId/submit", requireTeacherOperation, validate(staffSubmitProofSchema), AssignmentController.staffSubmit);
router.post("/:id/students/:studentId/grade", requireTeacherOperation, validate(gradeSubmissionSchema), AssignmentController.grade);

export default router;
