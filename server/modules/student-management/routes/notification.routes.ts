import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createNotificationSchema } from "../validations/notification.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS["student-notification"].manage]) as any;

router.use(authMiddleware);

router.post("/", requireManage, validate(createNotificationSchema), NotificationController.create);
router.get("/", NotificationController.getList);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), NotificationController.delete);

export default router;
