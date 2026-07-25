import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema } from "../validations/payment.validation";
import { idParamSchema } from "../validations/student.validation";
import { requirePermission } from "../../../middleware/auth";

const router = Router();
const requireManage = requirePermission("student:manage") as any;

router.use(authMiddleware);

router.post("/", requireManage, validate(createPaymentSchema), PaymentController.create);
router.get("/", PaymentController.getList);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), PaymentController.delete);

export default router;
