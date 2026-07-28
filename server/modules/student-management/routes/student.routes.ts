import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createStudentSchema, updateStudentSchema, idParamSchema, installmentParamsSchema, publicRegisterStudentSchema } from "../validations/student.validation";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";
import { requirePermission } from "../../../middleware/auth";

const router = Router();
export const publicStudentRouter = Router();
const requireManage = requirePermission("student:manage") as any;

publicStudentRouter.post("/public-register", publicApiRateLimiter, validate(publicRegisterStudentSchema), StudentController.publicRegister);
publicStudentRouter.get("/public-lookup", publicApiRateLimiter, StudentController.publicLookup);

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

