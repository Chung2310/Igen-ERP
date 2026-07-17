import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createStudentSchema, updateStudentSchema, idParamSchema, publicRegisterStudentSchema } from "../validations/student.validation";

const router = Router();

router.post("/public-register", validate(publicRegisterStudentSchema), StudentController.publicRegister);
router.get("/public-lookup", StudentController.publicLookup);

router.use(authMiddleware);

router.post("/", validate(createStudentSchema), StudentController.create);
router.post("/bulk", StudentController.bulkCreate);
router.post("/bulk-delete", StudentController.bulkDelete);
router.get("/", StudentController.getList);
router.get("/:id", validate(idParamSchema, "params"), StudentController.getDetail);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateStudentSchema), StudentController.update);
router.delete("/:id", validate(idParamSchema, "params"), StudentController.delete);
// Đánh dấu đã thu tiền đợt :no cho học viên :id
router.patch("/:id/installment/:no/mark-paid", validate(idParamSchema, "params"), StudentController.markInstallmentPaid);

export default router;

