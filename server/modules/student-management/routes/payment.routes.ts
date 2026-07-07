import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema } from "../validations/payment.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.post("/", validate(createPaymentSchema), PaymentController.create);
router.get("/", PaymentController.getList);
router.delete("/:id", validate(idParamSchema, "params"), PaymentController.delete);

export default router;
