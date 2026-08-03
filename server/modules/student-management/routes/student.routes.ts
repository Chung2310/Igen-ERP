import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import { adminUnassignedAuthMiddleware, authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createStudentSchema, updateStudentSchema, idParamSchema, installmentParamsSchema, publicRegisterStudentSchema, assignStudentBranchSchema } from "../validations/student.validation";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";
import { upload } from "../config/cloudinary";
import { publicRegisterConfigQuerySchema } from "../validations/standard-field.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
export const publicStudentRouter = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS["student-profile"].manage]) as any;

publicStudentRouter.post("/public-register", publicApiRateLimiter, validate(publicRegisterStudentSchema), StudentController.publicRegister);
publicStudentRouter.get("/public-register-config", publicApiRateLimiter, validate(publicRegisterConfigQuerySchema, "query"), StudentController.publicRegisterConfig);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
publicStudentRouter.post("/public-register-upload", publicApiRateLimiter, StudentController.assertPublicTeacher as any, upload.single("file") as any, StudentController.publicUpload as any);
publicStudentRouter.get("/public-lookup", publicApiRateLimiter, StudentController.publicLookup);

router.get("/unassigned", adminUnassignedAuthMiddleware, requireManage, StudentController.getUnassignedList);
router.patch("/:id/assign-branch", adminUnassignedAuthMiddleware, requireManage, validate(idParamSchema, "params"), validate(assignStudentBranchSchema), StudentController.assignBranch);

router.use(authMiddleware);

router.post("/", requireManage, validate(createStudentSchema), StudentController.create);
router.post("/bulk", requireManage, StudentController.bulkCreate);
router.post("/bulk-delete", requireManage, StudentController.bulkDelete);
router.get("/", StudentController.getList);
router.get("/:id", validate(idParamSchema, "params"), StudentController.getDetail);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updateStudentSchema), StudentController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), StudentController.delete);
// Đánh dấu đã thu tiền đợt :no cho học viên :id
router.patch("/:id/installment/:no/mark-paid", requireManage, validate(installmentParamsSchema, "params"), StudentController.markInstallmentPaid);

export default router;

