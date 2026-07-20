import { Router } from "express";
import { AssignmentController } from "../controllers/assignment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createAssignmentSchema,
  submitProofSchema,
  uploadProofFileSchema,
  gradeSubmissionSchema
} from "../validations/assignment.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireModule } from "../../../middleware/require-module";

const router = Router();

// Public routes for student submission (via encrypted JWT token in query parameter)
router.get("/public/detail", AssignmentController.getPublicDetail);
router.post("/public/upload", validate(uploadProofFileSchema), AssignmentController.uploadProofFile);
router.post("/public/submit", validate(submitProofSchema), AssignmentController.submitProof);
router.post("/public/cancel", AssignmentController.cancelSubmission);

// Private routes for Teachers & Admins
router.use(authMiddleware);
router.use(requireModule("student"));
router.post("/", validate(createAssignmentSchema), AssignmentController.create);
router.get("/", AssignmentController.getList);
router.get("/:id/submissions", validate(idParamSchema, "params"), AssignmentController.getSubmissions);
router.post("/:id/students/:studentId/grade", validate(gradeSubmissionSchema), AssignmentController.grade);

export default router;
