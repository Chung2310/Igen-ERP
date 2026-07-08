import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createNotificationSchema } from "../validations/notification.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.post("/", validate(createNotificationSchema), NotificationController.create);
router.get("/", NotificationController.getList);
router.delete("/:id", validate(idParamSchema, "params"), NotificationController.delete);

export default router;
