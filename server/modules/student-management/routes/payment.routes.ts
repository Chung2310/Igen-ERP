import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema, updatePaymentSchema } from "../validations/payment.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS.payment.manage]) as any;

router.use(authMiddleware);

router.post("/", requireManage, validate(createPaymentSchema), PaymentController.create);
router.get("/", PaymentController.getList);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updatePaymentSchema), PaymentController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), PaymentController.delete);

export default router;
